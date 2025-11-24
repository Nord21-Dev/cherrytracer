import { db } from "./db";
import { logs } from "./db/schema";
import { websocketService } from "./services/websocket";
import { partitioningService } from "./services/partitioning";

type NewLog = typeof logs.$inferInsert;

class IngestQueue {
  private queue: NewLog[] = [];
  
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 2000;
  // SAFETY CAP: If we hold more than 10k logs in RAM, drop new ones to save the server.
  private readonly MAX_QUEUE_SIZE = 10000; 
  
  private interval: Timer | null = null;
  private isFlushing = false;
  
  private flush = async (force = false) => {
    if (this.isFlushing && !force) return;
    if (this.queue.length === 0) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.BATCH_SIZE);

    const projectCounts = new Map<string, number>();
    batch.forEach(log => {
        const count = projectCounts.get(log.projectId) || 0;
        projectCounts.set(log.projectId, count + 1);
    });

    try {
      if (await partitioningService.isPartitionedLogsTable()) {
        const timestamps = batch
          .map((log) => log.timestamp)
          .filter((value): value is Date => value instanceof Date);

        if (timestamps.length) {
          const min = new Date(Math.min(...timestamps.map((t) => t.getTime())));
          const max = new Date(Math.max(...timestamps.map((t) => t.getTime())));
          await partitioningService.ensurePartitionsForRange(min, max);
        }
      }

      console.log(`[Queue] Flushing ${batch.length} logs...`);
      await db.insert(logs).values(batch);

      for (const [projectId, count] of projectCounts) {
          websocketService.broadcast(projectId, 'new_logs', { count });
      }

    } catch (error) {
      console.error("[Queue] ⚠️ Flush failed:", error);
      
      if (this.queue.length + batch.length <= this.MAX_QUEUE_SIZE) {
          console.log("[Queue] ↩️ Re-queueing failed batch");
          this.queue.unshift(...batch);
      } else {
          console.error("[Queue] ❌ Dropping failed batch (Queue Full)");
      }
    } finally {
      this.isFlushing = false;
      // If there are still items left (e.g. we had 2000 items), trigger immediately
      if (this.queue.length >= this.BATCH_SIZE) {
          setImmediate(() => this.flush());
      }
    }
  };

  constructor() {
    this.start();

    // Prepare partitions early so ingestion never fails right after midnight
    partitioningService.ensurePartitionedTable()
      .then(() => partitioningService.warmupPartitions())
      .catch((error) => {
        console.warn("[Queue] Failed to prepare partitions", error);
      });
    
    const shutdown = async () => {
      console.log("🛑 Shutting down ingest queue...");
      if (this.interval) clearInterval(this.interval);
      await this.flush(true); // Force final flush
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  public remainingCapacity() {
    return this.MAX_QUEUE_SIZE - this.queue.length;
  }

  public add(log: NewLog) {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn(`[Queue] ⚠️ Dropping log, queue full (${this.queue.length})`);
      return false; 
    }

    this.queue.push(log);
    
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }

    return true;
  }

  public start() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(this.flush, this.FLUSH_INTERVAL_MS);
  }
}

export const ingestQueue = new IngestQueue();
