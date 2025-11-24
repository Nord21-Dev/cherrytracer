import { sql } from "drizzle-orm";
import { db } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;
const PARTITIONING_ENABLED = process.env.LOG_PARTITIONING_ENABLED !== "false";
const AUTO_CONVERT = process.env.LOG_PARTITIONING_AUTOCONVERT !== "false";
const PRECREATE_DAYS_AHEAD = parseInt(process.env.LOG_PARTITION_PRECREATE_DAYS || "1", 10);

type Partition = {
  name: string;
  startMs: number;
  endMs: number;
};

const startOfDayUtc = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

export const partitioningService = {
  _isPartitionedCache: null as boolean | null,

  isEnabled() {
    return PARTITIONING_ENABLED;
  },

  async isPartitionedLogsTable() {
    if (!PARTITIONING_ENABLED) return false;
    if (this._isPartitionedCache !== null) return this._isPartitionedCache;

    try {
      const result = await db.execute(sql`SELECT c.relkind = 'p' AS is_partitioned FROM pg_class c WHERE c.oid = 'logs'::regclass`);
      const isPartitioned = Boolean(result?.[0]?.is_partitioned);
      this._isPartitionedCache = isPartitioned;
      if (!isPartitioned) {
        console.warn("[Partitioning] LOG_PARTITIONING_ENABLED=true but 'logs' is not partitioned. Skipping partition maintenance.");
      }
      return isPartitioned;
    } catch (error) {
      console.warn("[Partitioning] Unable to inspect logs table, assuming non-partitioned:", error);
      this._isPartitionedCache = false;
      return false;
    }
  },

  async ensurePartitionedTable() {
    if (!PARTITIONING_ENABLED) return false;

    const alreadyPartitioned = await this.isPartitionedLogsTable();
    if (alreadyPartitioned) return true;

    if (!AUTO_CONVERT) {
      console.warn("[Partitioning] logs table is not partitioned. Set LOG_PARTITIONING_AUTOCONVERT=true to migrate automatically or run docs/PARTITIONING.md manually.");
      return false;
    }

    const migrated = await this.convertToPartitionedTable();
    // Refresh cache
    this._isPartitionedCache = null;
    return migrated && (await this.isPartitionedLogsTable());
  },

  async convertToPartitionedTable() {
    try {
      await db.execute(sql`
        DO $$
        DECLARE
          is_partitioned boolean;
          has_data boolean;
          min_day date;
          max_day date;
          d date;
        BEGIN
          SELECT c.relkind = 'p' INTO is_partitioned FROM pg_class c WHERE c.oid = 'logs'::regclass;
          IF is_partitioned THEN
            RETURN;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'logs_unpartitioned' AND n.nspname = 'public'
          ) THEN
            RAISE EXCEPTION 'Temporary table logs_unpartitioned already exists. Please drop or rename it.';
          END IF;

          SELECT EXISTS (SELECT 1 FROM logs LIMIT 1) INTO has_data;

          EXECUTE 'ALTER TABLE logs RENAME TO logs_unpartitioned';
          EXECUTE 'CREATE TABLE logs (LIKE logs_unpartitioned INCLUDING DEFAULTS INCLUDING CONSTRAINTS) PARTITION BY RANGE ("timestamp")';

          IF has_data THEN
            SELECT date_trunc('day', MIN("timestamp"))::date, date_trunc('day', MAX("timestamp"))::date
            INTO min_day, max_day
            FROM logs_unpartitioned;
          ELSE
            min_day := CURRENT_DATE;
            max_day := CURRENT_DATE;
          END IF;

          FOR d IN SELECT generate_series(min_day, max_day + 1, interval '1 day')::date LOOP
            EXECUTE format(
              'CREATE TABLE IF NOT EXISTS %I PARTITION OF logs FOR VALUES FROM (%L) TO (%L);',
              format('logs_p%s', to_char(d, 'YYYYMMDD')),
              d,
              d + 1
            );
          END LOOP;

          IF has_data THEN
            EXECUTE 'INSERT INTO logs SELECT * FROM logs_unpartitioned';
          END IF;

          EXECUTE 'DROP TABLE logs_unpartitioned';
        END $$;
      `);

      // Create indexes after the old table is dropped to avoid name conflicts
      await db.execute(sql`CREATE INDEX IF NOT EXISTS project_idx ON logs (project_id);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS trace_idx ON logs (trace_id);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS time_idx ON logs ("timestamp");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS level_idx ON logs (level);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS data_gin_idx ON logs USING gin (data);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS message_search_idx ON logs USING gin (to_tsvector('simple', message));`);

      console.log("[Partitioning] Converted logs table to partitioned range table (daily).");
      return true;
    } catch (error) {
      console.error("[Partitioning] Failed to convert logs table to partitioned", error);
      return false;
    }
  },

  async warmupPartitions() {
    if (!(await this.isPartitionedLogsTable())) return;

    const today = startOfDayUtc(new Date());
    // Ensure yesterday/today/tomorrow so inserts around midnight never error
    const windowEnd = addDays(today, Math.max(1, PRECREATE_DAYS_AHEAD));
    await this.ensurePartitionsForRange(addDays(today, -1), windowEnd);
  },

  async ensurePartitionsForRange(from: Date, to: Date) {
    if (!(await this.isPartitionedLogsTable())) return;

    let cursor = startOfDayUtc(from);
    const last = startOfDayUtc(to);

    while (cursor.getTime() <= last.getTime()) {
      await this.ensurePartitionForDay(cursor);
      cursor = addDays(cursor, 1);
    }
  },

  async ensurePartitionForDay(day: Date) {
    if (!(await this.isPartitionedLogsTable())) return;

    const start = startOfDayUtc(day);
    const end = addDays(start, 1);
    const partitionName = `logs_p${start.toISOString().slice(0, 10).replace(/-/g, "")}`;
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    try {
      await db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = '${partitionName}' AND n.nspname = 'public'
          ) THEN
            EXECUTE 'CREATE TABLE "${partitionName}" PARTITION OF logs FOR VALUES FROM (''${startIso}'') TO (''${endIso}'')';
          END IF;
        END $$;
      `));
    } catch (error) {
      console.error(`[Partitioning] Failed to ensure partition for ${startIso}`, error);
    }
  },

  async listLeafPartitions(): Promise<Partition[]> {
    if (!(await this.isPartitionedLogsTable())) return [];

    try {
      const rows = await db.execute(sql`
        SELECT
          child.relid::regclass AS name,
          extract(epoch from (regexp_match(child.bound, 'FROM \\(''(.+?)''\\) TO')[1]::timestamptz)) * 1000 AS start_ms,
          extract(epoch from (regexp_match(child.bound, 'TO \\(''(.+?)''\\)')[1]::timestamptz)) * 1000 AS end_ms
        FROM pg_partition_tree('logs'::regclass) AS child
        WHERE child.isleaf = true
          AND child.bound LIKE 'FOR VALUES FROM%';
      `);

      return rows
        .map((row: any) => ({
          name: String(row.name),
          startMs: Number(row.start_ms),
          endMs: Number(row.end_ms),
        }))
        .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs))
        .sort((a, b) => a.startMs - b.startMs);
    } catch (error) {
      console.error("[Partitioning] Failed to list partitions", error);
      return [];
    }
  },

  async dropPartition(name: string) {
    if (!(await this.isPartitionedLogsTable())) return false;

    try {
      const safeName = name.replace(/"/g, "").replace(/'/g, "''");
      await db.execute(sql.raw(`
        DO $$
        DECLARE
          partition_name text := '${safeName}';
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_inherits i
            JOIN pg_class c ON c.oid = i.inhrelid
            WHERE i.inhparent = 'logs'::regclass
              AND c.relname = partition_name
          ) THEN
            EXECUTE format('ALTER TABLE logs DETACH PARTITION %I;', partition_name);
            EXECUTE format('DROP TABLE IF EXISTS %I;', partition_name);
          END IF;
        EXCEPTION WHEN undefined_table THEN
          -- Partition already gone, nothing to do
        END $$;
      `));
      console.log(`[Partitioning] Dropped partition ${name}`);
      return true;
    } catch (error) {
      console.error(`[Partitioning] Failed to drop partition ${name}`, error);
      return false;
    }
  },

  async dropPartitionsOlderThan(retentionDays: number) {
    if (!(await this.isPartitionedLogsTable())) return 0;
    const cutoffMs = Date.now() - retentionDays * DAY_MS;
    const partitions = await this.listLeafPartitions();

    let dropped = 0;
    for (const partition of partitions) {
      if (partition.endMs <= cutoffMs) {
        const ok = await this.dropPartition(partition.name);
        if (ok) dropped++;
      }
    }

    if (dropped) {
      console.log(`[Partitioning] Dropped ${dropped} partitions older than retention (${retentionDays} days)`);
    }

    return dropped;
  },

  async dropOldestPartition() {
    if (!(await this.isPartitionedLogsTable())) return false;

    const partitions = await this.listLeafPartitions();
    if (!partitions.length) return false;

    return this.dropPartition(partitions[0].name);
  },
};
