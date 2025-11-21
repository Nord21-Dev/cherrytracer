import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import { systemSettings } from "../db/schema";

export const systemService = {
  async getStorageStats() {
    const [sizeResult] = await db.execute(sql`
      SELECT pg_database_size(current_database()) as size
    `);
    
    const currentSizeBytes = Number(sizeResult.size); // Convert BigInt to Number

    const config = await this.getStorageConfig();

    return {
      used_bytes: currentSizeBytes,
      soft_limit_bytes: config.softLimitMb * 1024 * 1024,
      hard_limit_bytes: config.hardLimitMb * 1024 * 1024,
    };
  },

  async getStorageConfig() {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, 'storage_config'));
    
    if (result.length === 0) {
      // Default: 1GB Soft, 5GB Hard
      return { softLimitMb: 1024, hardLimitMb: 5120 };
    }

    return result[0].value as { softLimitMb: number; hardLimitMb: number };
  },

  async updateStorageConfig(softLimitMb: number, hardLimitMb: number) {
    await db.insert(systemSettings).values({
      key: 'storage_config',
      value: { softLimitMb, hardLimitMb }
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: { softLimitMb, hardLimitMb } }
    });

    return { softLimitMb, hardLimitMb };
  }
};