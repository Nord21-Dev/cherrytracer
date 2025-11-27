import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { logs } from "../db/schema";
import { sql } from "drizzle-orm";

export const statsRoutes = new Elysia({ prefix: "/stats" })
    .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
    .derive(async ({ jwt, cookie: { auth_session } }) => {
        if (!auth_session.value) return { user: null };
        return { user: await jwt.verify(auth_session.value as string) };
    })
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }
    })
    .get("/dashboard", async ({ query }) => {
        const { project_id, period = "24h" } = query;

        let interval = "30 minutes";
        let lookback = "24 hours";

        if (period === '1h') {
            interval = "1 minute";
            lookback = "1 hour";
        } else if (period === '7d') {
            interval = "4 hours";
            lookback = "7 days";
        }

        let bucketExpr;
        if (interval === "1 minute") {
            bucketExpr = sql`date_trunc('minute', timestamp)`;
        } else if (interval === "30 minutes") {
            bucketExpr = sql`date_trunc('hour', timestamp) + interval '30 minute' * (extract(minute from timestamp)::int / 30)`;
        } else if (interval === "4 hours") {
            bucketExpr = sql`date_trunc('day', timestamp) + interval '4 hour' * (extract(hour from timestamp)::int / 4)`;
        }

        // We cast to integer because Postgres returns BigInt (string in JSON)
        const timeSeries = await db.execute(sql`
            SELECT 
                ${bucketExpr} as date,
                COUNT(*)::int as total,
                COUNT(CASE WHEN level = 'error' THEN 1 END)::int as errors,
                COUNT(CASE WHEN level != 'error' THEN 1 END)::int as success
            FROM ${logs}
            WHERE project_id = ${project_id}
            AND timestamp > NOW() - INTERVAL '${sql.raw(lookback)}'
            GROUP BY 1
            ORDER BY 1 ASC
        `);

        const kpis = await db.execute(sql`
            SELECT 
                COUNT(*)::int as total_requests,
                COUNT(CASE WHEN level = 'error' THEN 1 END)::int as total_errors,
                COUNT(DISTINCT trace_id)::int as active_traces
            FROM ${logs}
            WHERE project_id = ${project_id}
            AND timestamp > NOW() - INTERVAL '${sql.raw(lookback)}'
        `);

        const offenders = await db.execute(sql`
            SELECT 
                message,
                level,
                COUNT(*)::int as count,
                MAX(timestamp) as last_seen
            FROM ${logs}
            WHERE project_id = ${project_id}
            AND level = 'error'
            AND timestamp > NOW() - INTERVAL '${sql.raw(lookback)}'
            GROUP BY 1, 2
            ORDER BY 3 DESC
            LIMIT 5
        `);

        const stats = kpis[0] as { total_requests: number; total_errors: number; active_traces: number };
        const errorRate = stats.total_requests > 0
            ? ((stats.total_errors / stats.total_requests) * 100).toFixed(2)
            : "0.00";

        return {
            chart: timeSeries,
            kpis: {
                ...stats,
                error_rate: errorRate
            },
            offenders
        };
    }, {
        query: t.Object({
            project_id: t.String(),
            period: t.Optional(t.String())
        })
    })
    .get("/spans", async ({ query }) => {
        const { project_id, period = "24h" } = query;

        let interval = "1 hour";
        let lookback = "24 hours";

        if (period === '1h') {
            interval = "5 minutes";
            lookback = "1 hour";
        } else if (period === '7d') {
            interval = "4 hours";
            lookback = "7 days";
        }

        let bucketExpr = sql`date_trunc('hour', timestamp)`;

        if (interval === "5 minutes") {
            bucketExpr = sql`date_trunc('hour', timestamp) + floor(extract(minute from timestamp) / 5)::int * interval '5 minutes'`;
        } else if (interval === "4 hours") {
            bucketExpr = sql`date_trunc('day', timestamp) + floor(extract(hour from timestamp) / 4)::int * interval '4 hours'`;
        }

        const spanNameExpr = sql`COALESCE(data->>'span_name', substring(message from 'Processed (.*)'))`;
        const statusExpr = sql`COALESCE(data->>'status', 'success')`;

        // Postgres SQL to aggregate span data
        const spans = await db.execute(sql`
            SELECT 
                ${bucketExpr} as time_bucket,
                ${spanNameExpr} as span_name,
                AVG((data->>'duration_ms')::numeric)::int as avg_latency,
                COUNT(*)::int as throughput,
                COUNT(CASE WHEN ${statusExpr} = 'error' THEN 1 END)::int as error_count,
                COUNT(CASE WHEN ${statusExpr} != 'error' THEN 1 END)::int as success_count
            FROM ${logs}
            WHERE project_id = ${project_id}
            AND data->>'span_event' = 'end'
            AND timestamp > NOW() - INTERVAL '${sql.raw(lookback)}'
            GROUP BY 1, 2
            ORDER BY 1 ASC
        `);

        return { data: spans };
    }, {
        query: t.Object({
            project_id: t.String(),
            period: t.Optional(t.String())
        })
    });
