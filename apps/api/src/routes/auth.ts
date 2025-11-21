import { Elysia, t } from "elysia";
import { userService } from "../services/user";
import { authPlugin } from "../plugins/jwt";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(authPlugin)
    .get("/status", async () => {
        const claimable = await userService.isClaimable();
        return { claimed: !claimable };
    })

    .post(
        "/setup",
        async ({ body, jwt, cookie: { auth_session }, set }) => {
            try {
                const { user, project } = await userService.createFirstUser(body.email, body.password);

                const token = await jwt.sign({ id: user.id, email: user.email });
                auth_session.set({
                    value: token,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    sameSite: "lax",
                    maxAge: 7 * 86400,
                });

                return { success: true, user: { id: user.id, email: user.email }, apiKey: project.apiKey };
            } catch (e) {
                set.status = 403;
                return { error: "Setup failed or system already claimed" };
            }
        },
        {
            body: t.Object({ email: t.String(), password: t.String() }),
        }
    )

    .post(
        "/login",
        async ({ body, jwt, cookie: { auth_session }, set }) => {
            const user = await userService.verifyUser(body.email, body.password);
            if (!user) {
                set.status = 401;
                return { error: "Invalid credentials" };
            }

            const token = await jwt.sign({ id: user.id, email: user.email });

            auth_session.set({
                value: token,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                path: "/",
                sameSite: "lax",
                maxAge: 7 * 86400,
            });

            return { success: true, user: { id: user.id, email: user.email } };
        },
        {
            body: t.Object({ email: t.String(), password: t.String() }),
        }
    )

    .get("/me", async ({ jwt, cookie: { auth_session }, set }) => {
        if (!auth_session.value) {
            set.status = 401;
            return { authenticated: false };
        }

        const profile = await jwt.verify(auth_session.value as string);
        if (!profile) {
            set.status = 401;
            return { authenticated: false };
        }

        return { authenticated: true, user: profile };
    })

    .post("/logout", ({ cookie: { auth_session } }) => {
        auth_session.remove();
        return { success: true };
    });