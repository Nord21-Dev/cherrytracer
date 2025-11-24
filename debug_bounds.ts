
import { sql } from "drizzle-orm";
import { db } from "./apps/api/src/db";

async function main() {
    console.log("Running debug script...");
    try {
        const rows = await db.execute(sql`
      SELECT
        child.relid::regclass AS name,
        pg_get_expr(c.relpartbound, c.oid) as raw_bound
      FROM pg_partition_tree('logs'::regclass) AS child
      JOIN pg_class c ON c.oid = child.relid
      WHERE child.isleaf = true
    `);
        console.log("Rows:", rows);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

main();
