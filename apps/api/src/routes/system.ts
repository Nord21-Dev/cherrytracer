import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { systemService } from "../services/system";

export const systemRoutes = new Elysia({ prefix: "/system" })
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
    // --- Versioning ---
    .get("/version", async () => {
        return await systemService.checkLatestVersion();
    })
    .post("/update", async () => {
        return await systemService.triggerUpdate();
    })
    .post("/truncate-logs", async () => {
        return await systemService.truncateLogs();
    })

    // --- Storage ---
    .get("/storage", async () => {
        const stats = await systemService.getStorageStats();
        const config = await systemService.getStorageConfig();
        // Return config specifically so frontend can populate the input
        return { ...stats, config };
    })
    .post("/storage", async ({ body }) => {
        return await systemService.updateStorageConfig(
            body.softLimitMb,
            body.hardLimitMb,
            body.updateWebhook,
            body.deployToken
        );
    }, {
        body: t.Object({
            softLimitMb: t.Number(),
            hardLimitMb: t.Number(),
            updateWebhook: t.Optional(t.String()),
            deployToken: t.Optional(t.String())
        })
    });