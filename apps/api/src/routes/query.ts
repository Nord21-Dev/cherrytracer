import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { logs, projects, logGroups } from "../db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

export const queryRoutes = new Elysia()
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET!,
        })
    )
    .derive(async ({ jwt, cookie: { auth_session }, set }) => {
        if (!auth_session.value) {
            return { user: null };
        }
        const user = await jwt.verify(auth_session.value as string);
        return { user };
    })
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }
    })
    .get("/logs", async ({ query }) => {
        const {
            project_id, limit = "50", offset = "0",
            level, search, start_date, end_date, trace_id, filters,
            exclude_system_events
        } = query;

        const conditions = [eq(logs.projectId, project_id)];

        if (exclude_system_events === 'true') {
            conditions.push(sql`${logs.message} NOT LIKE 'Span Started%'`);
            conditions.push(sql`${logs.message} NOT LIKE 'Span Ended%'`);
        }

        if (level) conditions.push(eq(logs.level, level));
        if (trace_id) conditions.push(eq(logs.traceId, trace_id));
        if (start_date) conditions.push(gte(logs.timestamp, new Date(start_date)));
        if (end_date) conditions.push(lte(logs.timestamp, new Date(end_date)));
        if (search) {
            conditions.push(sql`to_tsvector('simple', ${logs.message}) @@ plainto_tsquery('simple', ${search})`);
        }

        if (filters) {
            try {
                const parsed = JSON.parse(filters) as Record<string, string>;
                for (const [key, value] of Object.entries(parsed)) {
                    if (key.startsWith('data.')) {
                        const jsonKey = key.slice(5);
                        conditions.push(sql`${logs.data}->>${jsonKey} = ${value}`);
                    }
                }
            } catch (e) {
                // Ignore invalid JSON
            }
        }

        const data = await db.select()
            .from(logs)
            .where(and(...conditions))
            .limit(parseInt(limit))
            .offset(parseInt(offset))
            .orderBy(desc(logs.timestamp));

        return { data };
    }, {
        detail: { tags: ["Query"], summary: "Fetch Logs" },
        query: t.Object({
            project_id: t.String(),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            level: t.Optional(t.String()),
            search: t.Optional(t.String()),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String()),
            trace_id: t.Optional(t.String()),
            filters: t.Optional(t.String()), // JSON string of Record<string, string>
            exclude_system_events: t.Optional(t.String())
        })
    })
    .get("/stats", async ({ query }) => {
        const { project_id, bucket = "hour" } = query;

        const result = await db.execute(sql`
      SELECT 
        date_trunc(${bucket}, timestamp) as date,
        COUNT(*) as count,
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error_count
      FROM ${logs}
      WHERE project_id = ${project_id}
      AND timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

        return { stats: result };
    }, {
        detail: { tags: ["Query"], summary: "Get Activity Stats" },
        query: t.Object({
            project_id: t.String(),
            bucket: t.Optional(t.String({ default: 'hour' }))
        })
    })
    .get("/groups", async ({ query }) => {
        const {
            project_id, limit = "50", offset = "0", sort = "last_seen",
            level, exclude_system_events
        } = query;

        const conditions = [eq(logGroups.projectId, project_id)];

        if (level) {
            conditions.push(eq(logGroups.level, level));
        }

        if (exclude_system_events === 'true') {
            conditions.push(sql`${logGroups.pattern} NOT LIKE 'Span Started%'`);
            conditions.push(sql`${logGroups.pattern} NOT LIKE 'Span Ended%'`);
        }

        const orderBy = sort === "count" ? desc(logGroups.count) : desc(logGroups.lastSeen);

        const data = await db.select()
            .from(logGroups)
            .where(and(...conditions))
            .limit(parseInt(limit))
            .offset(parseInt(offset))
            .orderBy(orderBy);

        return { data };
    }, {
        detail: { tags: ["Query"], summary: "Fetch Log Groups" },
        query: t.Object({
            project_id: t.String(),
            limit: t.Optional(t.String()),
            offset: t.Optional(t.String()),
            sort: t.Optional(t.String()), // 'last_seen' | 'count'
            level: t.Optional(t.String()),
            exclude_system_events: t.Optional(t.String())
        })
    });