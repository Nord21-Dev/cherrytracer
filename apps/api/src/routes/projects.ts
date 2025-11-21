import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";

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
        return await db.select().from(projects);
    })
    .post("/", async ({ body }) => {
        const apiKey = "ct_" + crypto.randomUUID().replace(/-/g, "");
        const [newProject] = await db.insert(projects).values({
            name: body.name,
            icon: body.icon || "⚡️",
            apiKey,
        }).returning();

        return { project: newProject };
    }, {
        body: t.Object({
            name: t.String(),
            icon: t.Optional(t.String())
        })
    })
    .patch("/:id", async ({ params: { id }, body }) => {
        const [updated] = await db.update(projects)
            .set({
                name: body.name,
                icon: body.icon
            })
            .where(eq(projects.id, id))
            .returning();

        return { project: updated };
    }, {
        body: t.Object({
            name: t.Optional(t.String()),
            icon: t.Optional(t.String())
        })
    });