import { sql } from "drizzle-orm";
import { db } from "../db";
import { logs } from "../db/schema";
import { systemService } from "./system";
import { partitioningService } from "./partitioning";

export const cleanupService = {
  async pruneLogs() {
    console.log(`[Cleanup] Starting maintenance job...`);

    const retentionDays = parseInt(process.env.RETENTION_DAYS || "14");
    const partitionsActive = await partitioningService.ensurePartitionedTable();

    if (partitionsActive) {
      await partitioningService.warmupPartitions();
      await partitioningService.dropPartitionsOlderThan(retentionDays);
    } else {
      try {
        await db.execute(sql`
          DELETE FROM ${logs} 
          WHERE timestamp < NOW() - INTERVAL '${sql.raw(retentionDays.toString())} days'
        `);
      } catch (e) {
        console.error("[Cleanup] Time-based pruning failed:", e);
      }
    }

    try {
        const stats = await systemService.getStorageStats();
        
        // If we are over the soft limit
        if (stats.used_bytes > stats.soft_limit_bytes) {
            console.warn(`[Cleanup] ⚠️ DB Size (${(stats.used_bytes / 1024 / 1024).toFixed(2)}MB) exceeds limit. Pruning oldest logs...`);

            let reclaimedWithPartition = false;
            
            if (partitionsActive) {
              const dropped = await partitioningService.dropOldestPartition();
              if (!dropped) {
                console.warn("[Cleanup] Partition drop skipped (no partitions). Falling back to row deletes.");
              } else {
                console.log("[Cleanup] Dropped oldest partition to reclaim space.");
                reclaimedWithPartition = true;
              }
            }

            // Emergency Prune: Delete in batches of 5000 to avoid locking DB
            if (!reclaimedWithPartition) {
              await db.execute(sql`
                  DELETE FROM ${logs}
                  WHERE id IN (
                      SELECT id FROM ${logs}
                      ORDER BY timestamp ASC
                      LIMIT 5000
                  )
              `);
              console.log(`[Cleanup] Size-based pruning batch complete.`);
            }
        }
    } catch (e) {
        console.error("[Cleanup] Size-based pruning failed:", e);
    }
  }
};
