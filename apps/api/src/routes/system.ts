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
    // Get Storage Info
    .get("/storage", async () => {
        return await systemService.getStorageStats();
    })
    // Update Limits
    .post("/storage", async ({ body }) => {
        return await systemService.updateStorageConfig(body.softLimitMb, body.hardLimitMb);
    }, {
        body: t.Object({
            softLimitMb: t.Number(),
            hardLimitMb: t.Number()
        })
    });