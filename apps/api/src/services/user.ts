import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { users, projects, logs } from "../db/schema";

export const userService = {
  async isClaimable() {
    const [result] = await db.select({ count: count() }).from(users);
    return result.count === 0;
  },

  async seedOnboardingData(userId: string) {
    const [project] = await db.insert(projects).values({
        name: "My First Project",
        apiKey: "ct_" + crypto.randomUUID().replace(/-/g, ""),
    }).returning();

    await db.insert(logs).values({
        projectId: project.id,
        level: "info",
        message: "🍒 Cherrytracer installed successfully! This is your first log.",
        traceId: crypto.randomUUID().split('-')[0],
        data: { 
            os: "CherryOS", 
            note: "Use the API Key from settings to send your own logs!" 
        },
        timestamp: new Date()
    });

    return project;
  },

  async createFirstUser(email: string, plainPassword: string) {
    const isClaimable = await this.isClaimable();
    if (!isClaimable) throw new Error("System already claimed");
    
    const passwordHash = await Bun.password.hash(plainPassword);
    const [user] = await db.insert(users).values({ email, passwordHash }).returning();
    
    const project = await this.seedOnboardingData(user.id);

    return { user, project };
  },

  async verifyUser(email: string, plainPassword: string) {
    const user = await db.query.users.findFirst({ 
      where: eq(users.email, email) 
    });
    
    if (!user) return null;

    const isValid = await Bun.password.verify(plainPassword, user.passwordHash);
    return isValid ? user : null;
  },

  async ensureAdminExists(email: string, plainPassword: string) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return existing;

    console.log(`🔒 Seeding Admin User from ENV: ${email}`);
    const passwordHash = await Bun.password.hash(plainPassword);
    const [user] = await db.insert(users).values({ email, passwordHash }).returning();
    
    await this.seedOnboardingData(user.id);
    
    return user;
  }
};