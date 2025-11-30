import type { Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.sync.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    // Ignore partition tables so Drizzle doesn't try to manage them
    tablesFilter: ["!logs", "!events", "!logs_*", "!events_*"],
} satisfies Config;
