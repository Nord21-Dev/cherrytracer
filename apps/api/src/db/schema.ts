import { pgTable, text, timestamp, jsonb, uuid, index, varchar, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// System Settings (Singleton pattern via primary key)
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(), // e.g. 'storage_config'
  value: jsonb("value").notNull(), // { softLimitMb: 1024, hardLimitMb: 5120 }
});

// Users: System administrators
export const users = pgTable("users", {
  id: uuid("id").default(sql`uuidv7()`).primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  lastProjectId: uuid("last_project_id"),
});

// Projects: Simple API Key management
export const projects = pgTable("projects", {
  id: uuid("id").default(sql`uuidv7()`).primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").default("🍒"),
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  browserApiKey: varchar("browser_api_key", { length: 64 }).unique(),
  allowedReferrers: jsonb("allowed_referrers").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs: The heavy lifter
export const logs = pgTable("logs", {
  id: uuid("id").default(sql`uuidv7()`).primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  traceId: varchar("trace_id", { length: 64 }),
  spanId: varchar("span_id", { length: 64 }),
  source: varchar("source", { length: 16 }).notNull().default("server"),
  level: varchar("level", { length: 10 }).notNull(), // 'info', 'error', etc.
  message: text("message"),
  data: jsonb("data"), // Stores headers, payload, user_id
  fingerprint: varchar("fingerprint", { length: 64 }), // Link to log_groups
  timestamp: timestamp("timestamp", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => [
  // Indices for performance
  index("project_idx").on(table.projectId),
  index("trace_idx").on(table.traceId),
  index("time_idx").on(table.timestamp),
  index("level_idx").on(table.level),

  // GIN Index for JSONB allows fast searching inside the JSON blob
  index("data_gin_idx").using("gin", table.data),

  // Full Text Search Index for fast message searching
  index("message_search_idx").using("gin", sql`to_tsvector('simple', ${table.message})`),

  // Fingerprint index for grouping
  index("fingerprint_idx").on(table.fingerprint),
]);

// Log Groups: Smart Grouping (Hash/Vector)
export const logGroups = pgTable("log_groups", {
  id: uuid("id").default(sql`uuidv7()`).primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(), // Hash of the pattern
  pattern: text("pattern").notNull(), // The "template" of the log message
  exampleMessage: text("example_message"), // One real example
  level: varchar("level", { length: 10 }).notNull(),
  count: integer("count").notNull().default(1),
  firstSeen: timestamp("first_seen", { mode: 'date', withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { mode: 'date', withTimezone: true }).notNull(),
  // Future: embedding vector(1536)
}, (table) => [
  index("group_project_idx").on(table.projectId),
  index("group_fingerprint_idx").on(table.fingerprint),
  index("group_last_seen_idx").on(table.lastSeen),
  // Unique constraint for upsert
  uniqueIndex("group_unique_idx").on(table.projectId, table.fingerprint),
]);

export const logsRelations = relations(logs, ({ one }) => ({
  project: one(projects, {
    fields: [logs.projectId],
    references: [projects.id],
  }),
}));
