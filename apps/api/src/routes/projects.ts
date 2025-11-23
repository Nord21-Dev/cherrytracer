import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateApiKey, invalidateProjectKeyCache } from "../services/auth";
import { DEFAULT_DEV_REFERRERS, normalizeReferrers } from "../services/referrer";

export const projectRoutes = new Elysia({ prefix: "/projects" })
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
    .get("/", async () => {
        const existing = await db.select().from(projects);
        const updatedList = [...existing];

        const missingBrowserKeys = existing.filter((p: any) => !p.browserApiKey);
        if (missingBrowserKeys.length) {
            for (const project of missingBrowserKeys) {
                const [patched] = await db.update(projects)
                    .set({
                        browserApiKey: generateApiKey("browser"),
                        allowedReferrers: (project as any).allowedReferrers?.length
                            ? (project as any).allowedReferrers
                            : normalizeReferrers(DEFAULT_DEV_REFERRERS)
                    })
                    .where(eq(projects.id, project.id))
                    .returning();

                const idx = updatedList.findIndex((p) => p.id === project.id);
                if (patched && idx !== -1) updatedList[idx] = patched;
            }
            invalidateProjectKeyCache();
        }

        return updatedList;
    })
    .post("/", async ({ body, set }) => {
        let allowedReferrers = normalizeReferrers(DEFAULT_DEV_REFERRERS);
        try {
            if (body.allowedReferrers?.length) {
                allowedReferrers = normalizeReferrers(body.allowedReferrers);
            }
        } catch (error: any) {
            set.status = 400;
            return { error: error?.message || "Invalid referrer pattern" };
        }

        const [newProject] = await db.insert(projects).values({
            name: body.name,
            icon: body.icon || "⚡️",
            apiKey: generateApiKey("server"),
            browserApiKey: generateApiKey("browser"),
            allowedReferrers
        }).returning();

        invalidateProjectKeyCache();
        return { project: newProject };
    }, {
        body: t.Object({
            name: t.String(),
            icon: t.Optional(t.String()),
            allowedReferrers: t.Optional(t.Array(t.String()))
        })
    })
    .patch("/:id", async ({ params: { id }, body, set }) => {
        const updates: Record<string, any> = {};

        if (body.name !== undefined) updates.name = body.name;
        if (body.icon !== undefined) updates.icon = body.icon;

        if (body.allowedReferrers !== undefined) {
            try {
                updates.allowedReferrers = normalizeReferrers(body.allowedReferrers);
            } catch (error: any) {
                set.status = 400;
                return { error: error?.message || "Invalid referrer pattern" };
            }
        }

        if (body.regenerateServerKey) {
            updates.apiKey = generateApiKey("server");
        }

        if (body.regenerateBrowserKey) {
            updates.browserApiKey = generateApiKey("browser");
        }

        if (Object.keys(updates).length === 0) {
            set.status = 400;
            return { error: "No updates provided" };
        }

        const [updated] = await db.update(projects)
            .set(updates)
            .where(eq(projects.id, id))
            .returning();

        invalidateProjectKeyCache();
        return { project: updated };
    }, {
        body: t.Object({
            name: t.Optional(t.String()),
            icon: t.Optional(t.String()),
            allowedReferrers: t.Optional(t.Array(t.String())),
            regenerateServerKey: t.Optional(t.Boolean()),
            regenerateBrowserKey: t.Optional(t.Boolean())
        })
    });
