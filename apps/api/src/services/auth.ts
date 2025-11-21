import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects } from "../db/schema";

const projectCache = new Map<string, string>();

export const getProjectIdFromKey = async (apiKey: string): Promise<string | null> => {
  if (projectCache.has(apiKey)) {
    return projectCache.get(apiKey)!;
  }

  const result = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.apiKey, apiKey))
    .limit(1);

  if (result.length > 0) {
    projectCache.set(apiKey, result[0].id);
    return result[0].id;
  }

  return null;
};