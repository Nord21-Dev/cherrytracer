import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import { systemSettings } from "../db/schema";

const CURRENT_VERSION = process.env.APP_VERSION || "0.0.1";

export const systemService = {
  async getStorageStats() {
    const [sizeResult] = await db.execute(sql`
      SELECT pg_database_size(current_database()) as size
    `);

    const currentSizeBytes = Number(sizeResult.size);
    const config = await this.getStorageConfig();

    return {
      used_bytes: currentSizeBytes,
      soft_limit_bytes: config.softLimitMb * 1024 * 1024,
      hard_limit_bytes: config.hardLimitMb * 1024 * 1024,
    };
  },

  async getStorageConfig() {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, 'storage_config'));

    // Default config
    const defaults = { softLimitMb: 1024, hardLimitMb: 5120, updateWebhook: "", deployToken: "" };

    if (result.length === 0) return defaults;

    // Merge defaults with stored value to ensure updateWebhook exists
    return { ...defaults, ...(result[0].value as any) };
  },

  async updateStorageConfig(softLimitMb: number, hardLimitMb: number, updateWebhook?: string, deployToken?: string) {
    // Fetch current to preserve existing webhook if not provided
    const current = await this.getStorageConfig();
    const finalWebhook = updateWebhook !== undefined ? updateWebhook : current.updateWebhook;
    const finalToken = deployToken !== undefined ? deployToken : current.deployToken;

    const value = { softLimitMb, hardLimitMb, updateWebhook: finalWebhook, deployToken: finalToken };

    await db.insert(systemSettings).values({
      key: 'storage_config',
      value
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: { value }
    });

    return value;
  },

  // --- NEW UPDATE LOGIC ---

  async checkLatestVersion() {
    try {
      // ⚠️ REPLACE 'nord21dev/cherrytracer' WITH YOUR ACTUAL REPO
      const res = await fetch('https://api.github.com/repos/nord21dev/cherrytracer/releases/latest');
      if (!res.ok) throw new Error("GitHub API Error");

      const data = await res.json();
      const latestVersion = data.tag_name?.replace(/^v/, '') || CURRENT_VERSION;

      return {
        current: CURRENT_VERSION,
        latest: latestVersion,
        update_available: latestVersion !== CURRENT_VERSION,
        release_notes: data.body, // Markdown changelog
        release_url: data.html_url
      };
    } catch (e) {
      console.error("Failed to check version", e);
      return { current: CURRENT_VERSION, latest: CURRENT_VERSION, update_available: false };
    }
  },

  async triggerUpdate() {
    const config = await this.getStorageConfig();
    if (!config.updateWebhook) {
      throw new Error("No update webhook configured");
    }

    console.log("🚀 Triggering Coolify Update Webhook...");

    const headers: Record<string, string> = {};
    if (config.deployToken) {
      headers['Authorization'] = `Bearer ${config.deployToken}`;
    }

    // Fire and forget (fetch without await so we return response before server dies)
    fetch(config.updateWebhook, { headers }).catch(err => console.error("Webhook failed", err));

    return { status: "updating", message: "Update sequence started" };
  }
};