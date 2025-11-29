import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { cron } from "@elysiajs/cron";
import { authPlugin } from "./plugins/jwt";
import { ingestRoutes } from "./routes/ingest";
import { queryRoutes } from "./routes/query";
import { userService } from "./services/user";
import { authRoutes } from "./routes/auth";
import { cleanupService } from "./services/cleanup";
import { projectRoutes } from "./routes/projects";
import { statsRoutes } from "./routes/stats";
import { systemRoutes } from "./routes/system";
import { websocketService } from "./services/websocket";
import { db } from "./db";
import { projects } from "./db/schema";
import { eq } from "drizzle-orm";
import { indexService } from "./services/indexes";

const app = new Elysia()
    .use(cors({
        origin: true,
        credentials: true,
    }))
    .use(authPlugin)
    .use(openapi({
        path: '/openapi',
        documentation: {
            info: {
                title: 'Cherrytracer API',
                version: '1.0.0',
                description: 'Lightweight observability platform API'
            },
            tags: [
                { name: 'Ingestion', description: 'Log ingestion endpoints' },
                { name: 'Query', description: 'Dashboard data retrieval' }
            ]
        }
    }))
    .get("/", () => ({ status: "Cherrytracer API Online 🍒" }))
    .get("/api", () => ({ status: "Cherrytracer /API Online 🍒" }))
    .get("/health", () => ({ status: "ok" }))
    .use(ingestRoutes)
    .group("/api", (app) =>
        app
            .use(authRoutes)
            .use(queryRoutes)
            .use(projectRoutes)
            .use(statsRoutes)
            .use(systemRoutes)
    )
    .use(
        cron({
            name: 'prune-logs',
            pattern: '0 * * * *',
            run() {
                cleanupService.pruneLogs();
            }
        })
    )
    .derive(async ({ cookie: { auth_session }, jwt }) => {
        if (!auth_session.value) return { user: null };
        const profile = await jwt.verify(auth_session.value as string);
        return { user: profile || null };
    })
    .ws('/ws', {
        maxPayloadLength: 1024,
        idleTimeout: 60,
        perMessageDeflate: false,

        body: t.Object({
            type: t.String(),
            projectId: t.Optional(t.String())
        }),

        beforeHandle({ user }) {
            if (!user) {
                return new Response("Unauthorized", { status: 401 });
            }
        },

        open(ws) {
        },

        async message(ws, body) {
            if (body.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            if (body.type === 'subscribe' && body.projectId) {
                const { projectId } = body;

                const projectExists = await db.query.projects.findFirst({
                    where: eq(projects.id, projectId),
                    columns: { id: true }
                });

                if (!projectExists) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Project not found' }));
                    return;
                }

                websocketService.join(projectId, ws as any);
                ws.send(JSON.stringify({ type: 'connected', message: `Subscribed to ${projectId}` }));
            }
        },

        close(ws) {
        }
    });

const adminEmail = process.env.ADMIN_EMAIL;
const adminPass = process.env.ADMIN_PASSWORD;

if (adminEmail && adminPass) {
    try {
        await userService.ensureAdminExists(adminEmail, adminPass);
        console.log("🔐 Admin account active (seeded via ENV)");
    } catch (e) {
        console.error("⚠️ Failed to seed admin:", e);
        process.exit(1);
    }
}

indexService.ensureLogIndexes().catch((error) => {
    console.error("[Indexes] Failed to ensure log indexes", error);
});

const port = process.env.PORT || 3000;
app.listen({
    port: port,
    hostname: '0.0.0.0'
});

console.log(`🦊 Cherrytracer API running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Docs available at http://localhost:3000/openapi`);
