import { db } from "./db";
import { logs, logGroups, events } from "./db/schema";
import { websocketService } from "./services/websocket";
import { partitioningService } from "./services/partitioning";
import { sql } from "drizzle-orm";
import { createHash } from "crypto";

type NewLog = typeof logs.$inferInsert;
type NewEvent = typeof events.$inferInsert;
type QueueItem = NewLog | NewEvent;

// Regex patterns for fingerprinting
const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const HEX_REGEX = /0x[0-9a-fA-F]+/g;
const DIGIT_REGEX = /\d+/g;
const IP_REGEX = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;

const computeFingerprint = (message: string) => {
  let pattern = message
    .replace(UUID_REGEX, '<UUID>')
    .replace(IP_REGEX, '<IP>')
    .replace(HEX_REGEX, '<HEX>')
    .replace(DIGIT_REGEX, '<NUM>');

  // Truncate pattern if too long to avoid huge keys
  if (pattern.length > 1000) pattern = pattern.substring(0, 1000);

  const fingerprint = createHash('sha256').update(pattern).digest('hex').substring(0, 64);
  return { fingerprint, pattern };
};

class IngestQueue {
  private queue: QueueItem[] = [];

  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 2000;
  // SAFETY CAP: If we hold more than 10k logs in RAM, drop new ones to save the server.
  private readonly MAX_QUEUE_SIZE = 10000;

  private interval: Timer | null = null;
  private isFlushing = false;
  private notificationBuffer: Map<string, { total: number; critical: number }> = new Map();
  private notificationFlushScheduled = false;

  private scheduleNotificationFlush() {
    if (this.notificationFlushScheduled) return;

    this.notificationFlushScheduled = true;
    setImmediate(() => {
      this.notificationFlushScheduled = false;
      if (this.notificationBuffer.size === 0) return;

      const pending = this.notificationBuffer;
      this.notificationBuffer = new Map();

      for (const [projectId, counts] of pending) {
        websocketService.broadcast(projectId, 'new_logs', {
          count: counts.total,
          criticalCount: counts.critical,
        });
      }
    });
  }

  private flush = async (force = false) => {
    if (this.isFlushing && !force) return;
    if (this.queue.length === 0) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.BATCH_SIZE);

    const projectCounts = new Map<string, { total: number; critical: number }>();

    // Split batch into logs and events BEFORE fingerprinting
    const logsBatch: NewLog[] = [];
    const eventsBatch: NewEvent[] = [];

    for (const item of batch) {
      if ((item.data as any)?.type === 'event') {
        eventsBatch.push(item as NewEvent);
      } else {
        logsBatch.push(item as NewLog);
      }
    }

    // Pre-process logs batch to compute fingerprints (skip events)
    const processedLogsBatch = logsBatch.map(log => {
      const { fingerprint, pattern } = computeFingerprint(log.message || "");
      return { ...log, fingerprint, pattern };
    });

    // Combine for project counts (events don't need fingerprinting)
    const allProcessedBatch = [...processedLogsBatch, ...eventsBatch];

    allProcessedBatch.forEach(log => {
      const existing = projectCounts.get(log.projectId) || { total: 0, critical: 0 };
      const isCritical = (log.data as Record<string, any> | null)?.error_source === 'auto_captured';

      existing.total += 1;
      if (isCritical) existing.critical += 1;

      projectCounts.set(log.projectId, existing);
    });

    try {
      if (await partitioningService.isPartitionedLogsTable()) {
        const timestamps = allProcessedBatch
          .map((log) => log.timestamp)
          .filter((value): value is Date => value instanceof Date);

        if (timestamps.length) {
          const min = new Date(Math.min(...timestamps.map((t) => t.getTime())));
          const max = new Date(Math.max(...timestamps.map((t) => t.getTime())));
          await partitioningService.ensurePartitionsForRange(min, max);
        }
      }

      // 1. Upsert Log Groups (only for logs, not events)
      if (processedLogsBatch.length > 0) {
        const groupsMap = new Map<string, typeof logGroups.$inferInsert>();

        for (const log of processedLogsBatch) {
          if (!log.fingerprint) continue;
          const key = `${log.projectId}:${log.fingerprint}`;

          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              projectId: log.projectId,
              fingerprint: log.fingerprint,
              pattern: log.pattern,
              exampleMessage: log.message?.substring(0, 1000), // Store first example
              level: log.level,
              count: 1,
              firstSeen: log.timestamp,
              lastSeen: log.timestamp,
            });
          } else {
            // Update lastSeen for existing group in this batch
            const g = groupsMap.get(key)!;
            if (log.timestamp > g.lastSeen) g.lastSeen = log.timestamp;
            if (log.timestamp < g.firstSeen) g.firstSeen = log.timestamp;
            g.count = (g.count || 0) + 1;
          }
        }

        if (groupsMap.size > 0) {
          const groups = Array.from(groupsMap.values());
          await db.insert(logGroups)
            .values(groups)
            .onConflictDoUpdate({
              target: [logGroups.projectId, logGroups.fingerprint],
              set: {
                lastSeen: sql`GREATEST(${logGroups.lastSeen}, EXCLUDED.last_seen)`,
                count: sql`${logGroups.count} + 1`,
                // Optional: Update example message if we want fresh ones, but usually keeping the first is fine
              }
            });
        }
      }

      // 2. Insert Logs & Events
      if (processedLogsBatch.length) {
        await db.insert(logs).values(processedLogsBatch);
      }

      if (eventsBatch.length) {
        await db.insert(events).values(eventsBatch);
      }

      for (const [projectId, counts] of projectCounts) {
        const existing = this.notificationBuffer.get(projectId) || { total: 0, critical: 0 };
        this.notificationBuffer.set(projectId, {
          total: existing.total + counts.total,
          critical: existing.critical + counts.critical,
        });
      }

      this.scheduleNotificationFlush();

    } catch (error) {
      console.error("[Queue] ⚠️ Flush failed:", error);

      if (this.queue.length + batch.length <= this.MAX_QUEUE_SIZE) {
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

  public add(item: QueueItem) {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn(`[Queue] ⚠️ Dropping log, queue full (${this.queue.length})`);
      return false;
    }

    this.queue.push(item);

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
