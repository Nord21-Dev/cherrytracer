import { pgTable, text, timestamp, jsonb, uuid, index, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// System Settings (Singleton pattern via primary key)
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(), // e.g. 'storage_config'
  value: jsonb("value").notNull(), // { softLimitMb: 1024, hardLimitMb: 5120 }
});

// Users: System administrators
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// Projects: Simple API Key management
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").default("🍒"),
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  browserApiKey: varchar("browser_api_key", { length: 64 }).unique(),
  allowedReferrers: jsonb("allowed_referrers").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs: The heavy lifter
export const logs = pgTable("logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  traceId: varchar("trace_id", { length: 64 }),
  spanId: varchar("span_id", { length: 64 }),
  level: varchar("level", { length: 10 }).notNull(), // 'info', 'error', etc.
  message: text("message"),
  data: jsonb("data"), // Stores headers, payload, user_id
  timestamp: timestamp("timestamp", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => [
  // Indices for performance
  index("project_idx").on(table.projectId),
  index("trace_idx").on(table.traceId),
  index("time_idx").on(table.timestamp),
  
  // GIN Index for JSONB allows fast searching inside the JSON blob
  index("data_gin_idx").using("gin", table.data), 
]);

export const logsRelations = relations(logs, ({ one }) => ({
  project: one(projects, {
    fields: [logs.projectId],
    references: [projects.id],
  }),
}));
