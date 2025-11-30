import { pgTable, text, timestamp, jsonb, uuid, index, varchar, uniqueIndex, integer, decimal } from "drizzle-orm/pg-core";
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

// Events: Business events with optimized schema for analytics
export const events = pgTable("events", {
  id: uuid("id").default(sql`uuidv7()`).primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  traceId: varchar("trace_id", { length: 64 }),
  spanId: varchar("span_id", { length: 64 }),
  source: varchar("source", { length: 16 }).notNull().default("server"),
  message: text("message"), // Event name
  data: jsonb("data"), // Additional event properties
  // Event-specific fields for better analytics performance
  eventType: varchar("event_type", { length: 100 }), // e.g., 'user_signup', 'purchase', 'page_view'
  userId: varchar("user_id", { length: 255 }), // User identifier
  sessionId: varchar("session_id", { length: 255 }), // Session identifier
  value: decimal("value", { precision: 15, scale: 4 }), // Numeric value (revenue, duration, etc.)
  timestamp: timestamp("timestamp", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => [
  // Core indexes
  index("event_project_idx").on(table.projectId),
  index("event_trace_idx").on(table.traceId),
  index("event_time_idx").on(table.timestamp),

  // Event-specific indexes for analytics queries
  index("event_type_time_idx").on(table.eventType, table.timestamp),
  index("event_user_time_idx").on(table.userId, table.timestamp),
  index("event_session_time_idx").on(table.sessionId, table.timestamp),
  index("event_type_user_idx").on(table.eventType, table.userId),

  // JSONB index for flexible property queries
  index("event_data_gin_idx").using("gin", table.data),

  // Full text search on event name
  index("event_message_search_idx").using("gin", sql`to_tsvector('simple', ${table.message})`),

  // Value-based indexes for numeric analytics
  index("event_value_idx").on(table.value),
  index("event_type_value_idx").on(table.eventType, table.value),
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
