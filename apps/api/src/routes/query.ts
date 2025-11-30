import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { logs, logGroups, events } from "../db/schema";
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
            project_id, limit = "50", cursor,
            level, search, start_date, end_date, trace_id, filters,
            exclude_system_events, error_source, crash_only, include_data
        } = query;

        const conditions = [eq(logs.projectId, project_id)];
        const includeData = include_data === 'true';
        const needsFullData = Boolean(trace_id) || includeData;

        if (exclude_system_events === 'true') {
            // Hide tracer-emitted span lifecycle events by default
            conditions.push(sql`${logs.data}->>'span_event' IS NULL`);
        }

        if (level) conditions.push(eq(logs.level, level));
        if (trace_id) conditions.push(eq(logs.traceId, trace_id));
        if (start_date) conditions.push(gte(logs.timestamp, new Date(start_date)));
        if (end_date) conditions.push(lte(logs.timestamp, new Date(end_date)));
        if (search) {
            conditions.push(sql`to_tsvector('simple', ${logs.message}) @@ plainto_tsquery('simple', ${search})`);
        }

        const normalizedErrorSource = crash_only === 'true'
            ? 'auto_captured'
            : error_source;

        if (normalizedErrorSource) {
            conditions.push(sql`${logs.data}->>'error_source' = ${normalizedErrorSource}`);
        }

        if (filters) {
            try {
                const parsed = JSON.parse(filters) as Record<string, string>;
                for (const [key, value] of Object.entries(parsed)) {
                    if (key.startsWith('data.')) {
                        const jsonKey = key.slice(5);
                        const filterJson = { [jsonKey]: value };
                        conditions.push(sql`${logs.data} @> ${JSON.stringify(filterJson)}::jsonb`);
                    }
                }
            } catch (e) {
                // Ignore invalid JSON
            }
        }

        // Keyset pagination to avoid OFFSET scans
        if (cursor) {
            const [cursorTs, cursorId] = cursor.split("|");
            if (cursorTs && cursorId) {
                const cursorDate = new Date(cursorTs);
                if (!isNaN(cursorDate.getTime())) {
                    conditions.push(sql`(${logs.timestamp} < ${cursorDate} OR (${logs.timestamp} = ${cursorDate} AND ${logs.id} < ${cursorId}))`);
                }
            }
        }

        const limitValue = Math.min(Math.max(parseInt(limit), 1), 1000);

        const selectShape: Record<string, any> = {
            id: logs.id,
            timestamp: logs.timestamp,
            level: logs.level,
            source: logs.source,
            message: logs.message,
            traceId: logs.traceId,
            isCritical: sql<boolean>`(${logs.data}->>'error_source' = 'auto_captured')`
        };

        if (needsFullData) {
            selectShape.data = logs.data;
            selectShape.spanId = logs.spanId;
        }

        const rows = await db.select(selectShape)
            .from(logs)
            .where(and(...conditions))
            // Fetch an extra row to build next cursor cheaply
            .limit(limitValue + 1)
            .orderBy(desc(logs.timestamp), desc(logs.id));

        const hasNextPage = rows.length > limitValue;
        const page = hasNextPage ? rows.slice(0, limitValue) : rows;
        const lastRow = page.length ? page[page.length - 1] : undefined;
        const nextCursor = hasNextPage && lastRow
            ? `${lastRow.timestamp.toISOString()}|${lastRow.id}`
            : null;

        return { data: page, nextCursor };
    }, {
        detail: { tags: ["Query"], summary: "Fetch Logs" },
        query: t.Object({
            project_id: t.String(),
            limit: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
            level: t.Optional(t.String()),
            search: t.Optional(t.String()),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String()),
            trace_id: t.Optional(t.String()),
            filters: t.Optional(t.String()), // JSON string of Record<string, string>
            exclude_system_events: t.Optional(t.String()),
            error_source: t.Optional(t.String()),
            crash_only: t.Optional(t.String()),
            include_data: t.Optional(t.String())
        })
    })
    .get("/logs/:id", async ({ params, query, set }) => {
        const { id } = params;
        const { project_id } = query;

        const row = await db.query.logs.findFirst({
            where: and(eq(logs.id, id), eq(logs.projectId, project_id))
        });

        if (!row) {
            set.status = 404;
            return { error: "Log not found" };
        }

        return {
            data: {
                id: row.id,
                timestamp: row.timestamp,
                level: row.level,
                source: row.source,
                message: row.message,
                traceId: row.traceId,
                spanId: row.spanId,
                data: row.data,
                isCritical: ((row.data as Record<string, any> | null)?.error_source) === 'auto_captured'
            }
        };
    })
    .get("/events", async ({ query }) => {
        const {
            project_id, limit = "50", cursor,
            search, start_date, end_date, trace_id, filters,
            exclude_system_events, include_data
        } = query;

        const conditions = [eq(events.projectId, project_id)];
        const includeData = include_data === 'true';
        const needsFullData = Boolean(trace_id) || includeData;

        if (exclude_system_events === 'true') {
            // Hide tracer-emitted span lifecycle events by default
            conditions.push(sql`${events.data}->>'span_event' IS NULL`);
        }

        if (trace_id) conditions.push(eq(events.traceId, trace_id));
        if (start_date) conditions.push(gte(events.timestamp, new Date(start_date)));
        if (end_date) conditions.push(lte(events.timestamp, new Date(end_date)));
        if (search) {
            conditions.push(sql`to_tsvector('simple', ${events.message}) @@ plainto_tsquery('simple', ${search})`);
        }

        if (filters) {
            try {
                const parsed = JSON.parse(filters) as Record<string, string>;
                for (const [key, value] of Object.entries(parsed)) {
                    if (key === 'eventType') {
                        conditions.push(eq(events.eventType, value));
                    } else if (key === 'userId') {
                        conditions.push(eq(events.userId, value));
                    } else if (key === 'sessionId') {
                        conditions.push(eq(events.sessionId, value));
                    } else if (key === 'value') {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            conditions.push(sql`${events.value} = ${numValue}`);
                        }
                    } else if (key.startsWith('data.')) {
                        const jsonKey = key.slice(5);
                        const filterJson = { [jsonKey]: value };
                        conditions.push(sql`${events.data} @> ${JSON.stringify(filterJson)}::jsonb`);
                    }
                }
            } catch (e) {
                // Ignore invalid JSON
            }
        }

        // Keyset pagination to avoid OFFSET scans
        if (cursor) {
            const [cursorTs, cursorId] = cursor.split("|");
            if (cursorTs && cursorId) {
                const cursorDate = new Date(cursorTs);
                if (!isNaN(cursorDate.getTime())) {
                    conditions.push(sql`(${events.timestamp} < ${cursorDate} OR (${events.timestamp} = ${cursorDate} AND ${events.id} < ${cursorId}))`);
                }
            }
        }

        const limitValue = Math.min(Math.max(parseInt(limit), 1), 1000);

        const selectShape: Record<string, any> = {
            id: events.id,
            timestamp: events.timestamp,
            source: events.source,
            message: events.message,
            traceId: events.traceId,
            eventType: events.eventType,
            userId: events.userId,
            sessionId: events.sessionId,
            value: events.value,
            isError: sql<boolean>`${events.eventType} = 'error'`
        };

        if (needsFullData) {
            selectShape.data = events.data;
            selectShape.spanId = events.spanId;
        }

        const rows = await db.select(selectShape)
            .from(events)
            .where(and(...conditions))
            // Fetch an extra row to build next cursor cheaply
            .limit(limitValue + 1)
            .orderBy(desc(events.timestamp), desc(events.id));

        const hasNextPage = rows.length > limitValue;
        const page = hasNextPage ? rows.slice(0, limitValue) : rows;
        const lastRow = page.length ? page[page.length - 1] : undefined;
        const nextCursor = hasNextPage && lastRow
            ? `${lastRow.timestamp.toISOString()}|${lastRow.id}`
            : null;

        return { data: page, nextCursor };
    }, {
        detail: { tags: ["Query"], summary: "Fetch Events" },
        query: t.Object({
            project_id: t.String(),
            limit: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
            search: t.Optional(t.String()),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String()),
            trace_id: t.Optional(t.String()),
            filters: t.Optional(t.String()), // JSON string of Record<string, string>
            exclude_system_events: t.Optional(t.String()),
            include_data: t.Optional(t.String())
        })
    })
    .get("/events/analytics", async ({ query }) => {
        const { project_id, start_date, end_date, limit = "50" } = query;

        const parsedLimit = parseInt(limit, 10);
        const limitValue = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 200);
        const now = new Date();

        let start = start_date ? new Date(start_date) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        let end = end_date ? new Date(end_date) : now;

        if (isNaN(start.getTime())) start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (isNaN(end.getTime())) end = now;
        if (end < start) [start, end] = [end, start];

        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const bucketSize = durationHours <= 48 ? 'hour' : 'day';
        const bucketExpr = bucketSize === 'hour'
            ? sql`date_trunc('hour', timestamp)`
            : sql`date_trunc('day', timestamp)`;

        // Aggregate by event name (event_type preferred, falling back to message)
        const eventNameExpr = sql`COALESCE(${events.eventType}, ${events.message}, 'unknown')`;

        const topEvents = await db.execute(sql`
            SELECT 
                ${eventNameExpr} as event_name,
                COUNT(*)::int as count,
                COALESCE(SUM(${events.value}), 0)::float as total_value,
                MAX(${events.timestamp}) as last_seen
            FROM ${events}
            WHERE ${events.projectId} = ${project_id}
            AND ${events.timestamp} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
            GROUP BY 1
            ORDER BY count DESC
            LIMIT ${limitValue}
        `);

        const eventNames = topEvents
            .map((row) => row.event_name as string)
            .filter(Boolean);

        let sparklineRows: Array<{
            event_name: string;
            bucket: Date;
            count: number;
            total_value: number;
        }> = [];

        if (eventNames.length) {
            const eventNameList = sql.join(
                eventNames.map((name) => sql`${name}`),
                sql`, `
            );

            sparklineRows = await db.execute(sql`
                SELECT 
                    ${eventNameExpr} as event_name,
                    ${bucketExpr} as bucket,
                    COUNT(*)::int as count,
                    COALESCE(SUM(${events.value}), 0)::float as total_value
                FROM ${events}
                WHERE ${events.projectId} = ${project_id}
                AND ${events.timestamp} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
                AND ${eventNameExpr} IN (${eventNameList})
                GROUP BY 1, 2
                ORDER BY 1, 2
            `);
        }

        const alignToBucketStart = (date: Date) => {
            const aligned = new Date(date);
            if (bucketSize === 'hour') {
                aligned.setUTCMinutes(0, 0, 0);
            } else {
                aligned.setUTCHours(0, 0, 0, 0);
            }
            return aligned;
        };

        const bucketStart = alignToBucketStart(start);
        const bucketEnd = alignToBucketStart(end);
        const bucketStep = bucketSize === 'hour'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;

        const buckets: number[] = [];
        for (let cursor = bucketStart.getTime(); cursor <= bucketEnd.getTime(); cursor += bucketStep) {
            buckets.push(cursor);
        }

        const sparklineMap = new Map<string, Map<number, { count: number; totalValue: number }>>();
        for (const row of sparklineRows) {
            const bucketDate = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
            const bucketTs = bucketDate.getTime();
            const existing = sparklineMap.get(row.event_name) || new Map();
            existing.set(bucketTs, { count: row.count, totalValue: row.total_value || 0 });
            sparklineMap.set(row.event_name, existing);
        }

        const data = topEvents.map((row) => {
            const eventName = (row.event_name as string) || 'unknown';
            const bucketCounts = sparklineMap.get(eventName) || new Map();
            const sparkline = buckets.map((ts) => ({
                timestamp: ts,
                count: bucketCounts.get(ts)?.count || 0,
                totalValue: bucketCounts.get(ts)?.totalValue || 0
            }));

            return {
                id: eventName,
                eventName,
                count: row.count as number,
                totalValue: row.total_value ?? 0,
                lastSeen: row.last_seen,
                sparkline
            };
        });

        return {
            data,
            bucketSize,
            start: start.toISOString(),
            end: end.toISOString()
        };
    }, {
        detail: { tags: ["Query"], summary: "Event analytics by name" },
        query: t.Object({
            project_id: t.String(),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String()),
            limit: t.Optional(t.String())
        })
    })
    .get("/events/:id", async ({ params, query, set }) => {
        const { id } = params;
        const { project_id } = query;

        const row = await db.query.events.findFirst({
            where: and(eq(events.id, id), eq(events.projectId, project_id))
        });

        if (!row) {
            set.status = 404;
            return { error: "Event not found" };
        }

        return {
            data: {
                id: row.id,
                timestamp: row.timestamp,
                source: row.source,
                message: row.message,
                traceId: row.traceId,
                spanId: row.spanId,
                eventType: row.eventType,
                userId: row.userId,
                sessionId: row.sessionId,
                value: row.value,
                data: row.data,
                isError: row.eventType === 'error'
            }
        };
    }, {
        detail: { tags: ["Query"], summary: "Fetch Event Detail" },
        params: t.Object({ id: t.String() }),
        query: t.Object({ project_id: t.String() })
    })
    .get("/crashes", async ({ query }) => {
        const { project_id, limit = "20", start_date, end_date } = query;

        const clauses = [
            sql`${logs.projectId} = ${project_id}`,
            sql`${logs.data}->>'error_source' = 'auto_captured'`
        ];

        if (start_date) clauses.push(sql`${logs.timestamp} >= ${new Date(start_date)}`);
        if (end_date) clauses.push(sql`${logs.timestamp} <= ${new Date(end_date)}`);

        const whereSql = sql.join(clauses, sql` AND `);
        const limitValue = Math.min(Math.max(parseInt(limit), 1), 100);

        const crashRows = await db.execute(sql`
            SELECT 
                ${logs.message} AS message,
                ${logs.data}->>'error_type' AS error_type,
                ${logs.data}->>'error_name' AS error_name,
                (${logs.data}->'stack_trace'->>0) AS top_frame,
                COUNT(*)::int AS count,
                MAX(${logs.timestamp}) AS last_seen
            FROM ${logs}
            WHERE ${whereSql}
            GROUP BY message, error_type, error_name, top_frame
            ORDER BY count DESC, last_seen DESC
            LIMIT ${limitValue}
        `);

        return { data: crashRows };
    }, {
        detail: { tags: ["Query"], summary: "Crash summaries" },
        query: t.Object({
            project_id: t.String(),
            limit: t.Optional(t.String()),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String())
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
            level, exclude_system_events, error_source, crash_only, filters
        } = query;

        const conditions = [eq(logGroups.projectId, project_id)];

        if (level) {
            conditions.push(eq(logGroups.level, level));
        }

        if (exclude_system_events === 'true') {
            // Hide groups whose source logs are tracer lifecycle events
            conditions.push(sql`NOT EXISTS (
                SELECT 1 FROM ${logs}
                WHERE ${logs.projectId} = ${logGroups.projectId}
                  AND ${logs.fingerprint} = ${logGroups.fingerprint}
                  AND ${logs.data}->>'span_event' IS NOT NULL
            )`);
        }

        const normalizedGroupErrorSource = crash_only === 'true'
            ? 'auto_captured'
            : error_source;

        if (normalizedGroupErrorSource) {
            conditions.push(sql`EXISTS (
                SELECT 1 FROM ${logs} as source
                WHERE source.project_id = ${logGroups.projectId}
                  AND source.fingerprint = ${logGroups.fingerprint}
                  AND source.data->>'error_source' = ${normalizedGroupErrorSource}
            )`);
        }

        if (filters) {
            try {
                const parsed = JSON.parse(filters) as Record<string, string>;
                for (const [key, value] of Object.entries(parsed)) {
                    if (key.startsWith('data.')) {
                        const jsonKey = key.slice(5);
                        const filterJson = { [jsonKey]: value };
                        // We need to check if ANY log in the group matches the filter
                        // This is expensive but correct.
                        // Alternatively, if we assume all logs in a group share the same structure (which they should for 'type'),
                        // we can check one.
                        // But wait, 'type' is not in logGroups table. It's in logs.
                        // So we must join or exists.
                        conditions.push(sql`EXISTS (
                            SELECT 1 FROM ${logs} as source
                            WHERE source.project_id = ${logGroups.projectId}
                              AND source.fingerprint = ${logGroups.fingerprint}
                              AND source.data @> ${JSON.stringify(filterJson)}::jsonb
                        )`);
                    }
                }
            } catch (e) {
                // Ignore invalid JSON
            }
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
            exclude_system_events: t.Optional(t.String()),
            error_source: t.Optional(t.String()),
            crash_only: t.Optional(t.String()),
            filters: t.Optional(t.String())
        })
    });
