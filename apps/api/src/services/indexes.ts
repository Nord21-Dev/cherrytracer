import { sql } from "drizzle-orm";
import { db } from "../db";

export const indexService = {
  async ensureLogIndexes() {
    // Supports keyset pagination and index-only scans for the logs page
    await db.execute(sql`CREATE INDEX IF NOT EXISTS logs_project_ts_id_desc_idx ON logs (project_id, "timestamp" DESC, id DESC);`);

    // Fast path for default "exclude system events" view
    await db.execute(sql`CREATE INDEX IF NOT EXISTS logs_project_ts_nosystem_idx ON logs (project_id, "timestamp" DESC) WHERE data->>'span_event' IS NULL;`);

    // Fast path for crash-only view
    await db.execute(sql`CREATE INDEX IF NOT EXISTS logs_project_ts_crash_idx ON logs (project_id, "timestamp" DESC) WHERE data->>'error_source' = 'auto_captured';`);
  }
};
