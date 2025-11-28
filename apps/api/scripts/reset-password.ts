import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🍒 CherryTracer Password Reset Tool");

    // 1. Fetch all users
    const allUsers = await db.select().from(users);

    if (allUsers.length === 0) {
        console.error("❌ No users found in the database.");
        process.exit(1);
    }

    let targetUser;

    // 2. Determine target user
    const emailArg = process.argv[2];

    if (emailArg) {
        targetUser = allUsers.find(u => u.email === emailArg);
        if (!targetUser) {
            console.error(`❌ User with email '${emailArg}' not found.`);
            console.log("Available users:");
            allUsers.forEach(u => console.log(` - ${u.email}`));
            process.exit(1);
        }
    } else {
        if (allUsers.length === 1) {
            targetUser = allUsers[0];
        } else {
            console.error("❌ Multiple users found. Please specify the email as an argument.");
            console.log("Usage: bun run reset-password <email>");
            console.log("Available users:");
            allUsers.forEach(u => console.log(` - ${u.email}`));
            process.exit(1);
        }
    }

    // 3. Generate new password
    // Generate a secure random password
    const newPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const passwordHash = await Bun.password.hash(newPassword);

    // 4. Update user
    await db.update(users)
        .set({ passwordHash })
        .where(eq(users.id, targetUser.id));

    // 5. Output result
    console.log("\n✅ Password reset successfully!");
    console.log(`📧 Email:    ${targetUser.email}`);
    console.log(`🔑 Password: ${newPassword}`);
    console.log("\nPlease copy this password immediately.");

    process.exit(0);
}

main().catch(err => {
    console.error("❌ Error resetting password:", err);
    process.exit(1);
});
