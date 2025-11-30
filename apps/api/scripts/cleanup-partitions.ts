import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) process.exit(1);

const sql = postgres(DATABASE_URL);

async function main() {
    console.log("Dropping conflicting partitions...");
    try {
        await sql`DROP TABLE IF EXISTS logs_2025_11`;
        await sql`DROP TABLE IF EXISTS logs_2025_12`;
        await sql`DROP TABLE IF EXISTS events_2025_11`;
        await sql`DROP TABLE IF EXISTS events_2025_12`;
        console.log("✅ Dropped.");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
