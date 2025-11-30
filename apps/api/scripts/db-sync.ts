import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { $ } from "bun";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
    console.log("🚀 Starting DB Sync...");

    // Step 1: Run Drizzle Push for standard tables
    console.log("\n📦 Syncing standard tables with Drizzle...");
    try {
        await $`bun x drizzle-kit push --config drizzle.config.sync.ts`;
    } catch (error) {
        console.error("❌ Drizzle push failed:", error);
        process.exit(1);
    }

    // Step 2: Handle Partition Tables
    console.log("\n🗂️  Syncing partition tables...");

    // --- LOGS TABLE ---
    console.log("  - Checking 'logs' table...");
    await client`
    CREATE TABLE IF NOT EXISTS logs (
      id uuid DEFAULT uuidv7(),
      project_id uuid NOT NULL,
      trace_id varchar(64),
      span_id varchar(64),
      source varchar(16) DEFAULT 'server' NOT NULL,
      level varchar(10) NOT NULL,
      message text,
      data jsonb,
      fingerprint varchar(64),
      timestamp timestamptz NOT NULL,
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);
  `;

    // Indices for logs
    await client`CREATE INDEX IF NOT EXISTS logs_project_idx ON logs (project_id)`;
    await client`CREATE INDEX IF NOT EXISTS logs_trace_idx ON logs (trace_id)`;
    await client`CREATE INDEX IF NOT EXISTS logs_time_idx ON logs (timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS logs_level_idx ON logs (level)`;
    await client`CREATE INDEX IF NOT EXISTS logs_data_gin_idx ON logs USING gin (data)`;
    await client`CREATE INDEX IF NOT EXISTS logs_message_search_idx ON logs USING gin (to_tsvector('simple', message))`;
    await client`CREATE INDEX IF NOT EXISTS logs_fingerprint_idx ON logs (fingerprint)`;

    // --- EVENTS TABLE ---
    console.log("  - Checking 'events' table...");
    await client`
    CREATE TABLE IF NOT EXISTS events (
      id uuid DEFAULT uuidv7(),
      project_id uuid NOT NULL,
      trace_id varchar(64),
      span_id varchar(64),
      source varchar(16) DEFAULT 'server' NOT NULL,
      message text,
      data jsonb,
      event_type varchar(100),
      user_id varchar(255),
      session_id varchar(255),
      value decimal(15, 4),
      timestamp timestamptz NOT NULL,
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);
  `;

    // Indices for events
    await client`CREATE INDEX IF NOT EXISTS events_project_idx ON events (project_id)`;
    await client`CREATE INDEX IF NOT EXISTS events_trace_idx ON events (trace_id)`;
    await client`CREATE INDEX IF NOT EXISTS events_time_idx ON events (timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS events_type_time_idx ON events (event_type, timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS events_user_time_idx ON events (user_id, timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS events_session_time_idx ON events (session_id, timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS events_type_user_idx ON events (event_type, user_id)`;
    await client`CREATE INDEX IF NOT EXISTS events_data_gin_idx ON events USING gin (data)`;
    await client`CREATE INDEX IF NOT EXISTS events_message_search_idx ON events USING gin (to_tsvector('simple', message))`;
    await client`CREATE INDEX IF NOT EXISTS events_value_idx ON events (value)`;
    await client`CREATE INDEX IF NOT EXISTS events_type_value_idx ON events (event_type, value)`;


    // Step 3: Create Partitions
    console.log("\n📅 Managing partitions...");

    const tables = ['logs', 'events'];

    for (const table of tables) {
        // Check if table is actually partitioned
        const [tableInfo] = await client`
        SELECT relkind FROM pg_class 
        WHERE relname = ${table} 
        AND relnamespace = 'public'::regnamespace
      `;

        if (!tableInfo || tableInfo.relkind !== 'p') {
            console.warn(`    ⚠️  Table '${table}' exists but is NOT a partitioned table (relkind: ${tableInfo?.relkind}). Skipping partition management.`);
            continue;
        }

        // Default partition
        try {
            await client`CREATE TABLE IF NOT EXISTS ${client(table + '_default')} PARTITION OF ${client(table)} DEFAULT`;
        } catch (error: any) {
            // Ignore "already exists" for default partition if it happens (though IF NOT EXISTS handles it usually)
            if (error.code !== '42P07') {
                console.warn(`    ⚠️  Could not create default partition for ${table}: ${error.message}`);
            }
        }

        // Current day
        const now = new Date();
        // Ensure we cover today and tomorrow (matching app logic usually)
        // App uses logs_pYYYYMMDD

        const createDailyPartition = async (date: Date) => {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();

            const start = new Date(Date.UTC(year, month - 1, day));
            const end = new Date(Date.UTC(year, month - 1, day + 1));

            const startStr = start.toISOString();
            const endStr = end.toISOString();

            // Format: logs_p20251130
            const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
            const partitionName = `${table}_p${dateStr}`;

            console.log(`    - Ensuring partition ${partitionName} (${startStr} to ${endStr})...`);

            try {
                await client.unsafe(`
              CREATE TABLE IF NOT EXISTS "${partitionName}"
              PARTITION OF "${table}"
              FOR VALUES FROM ('${startStr}') TO ('${endStr}')
            `);
            } catch (error: any) {
                if (error.code === '42P17') {
                    console.warn(`    ⚠️  Partition ${partitionName} overlaps with existing partition. Skipping.`);
                } else {
                    throw error;
                }
            }
        };

        // Create for today and next 7 days to be safe
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            await createDailyPartition(d);
        }
    }

    console.log("\n✅ DB Sync Complete!");
    process.exit(0);
}

main();

