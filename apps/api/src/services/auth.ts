import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { projects } from "../db/schema";

export type ProjectKeyInfo = {
  projectId: string;
  type: "server" | "browser";
  allowedReferrers: string[];
};

const projectCache = new Map<string, ProjectKeyInfo>();

export const invalidateProjectKeyCache = () => projectCache.clear();

export const generateApiKey = (type: "server" | "browser" = "server") => {
  const prefix = type === "browser" ? "ct_pub_" : "ct_";
  return prefix + crypto.randomUUID().replace(/-/g, "");
};

export const getProjectKeyInfo = async (apiKey: string): Promise<ProjectKeyInfo | null> => {
  if (projectCache.has(apiKey)) {
    return projectCache.get(apiKey)!;
  }

  const result = await db
    .select({
      id: projects.id,
      apiKey: projects.apiKey,
      browserApiKey: projects.browserApiKey,
      allowedReferrers: projects.allowedReferrers
    })
    .from(projects)
    .where(or(
      eq(projects.apiKey, apiKey),
      eq(projects.browserApiKey, apiKey)
    ))
    .limit(1);

  if (result.length > 0) {
    const row = result[0];
    const info: ProjectKeyInfo = row.apiKey === apiKey
      ? { projectId: row.id, type: "server", allowedReferrers: [] }
      : { projectId: row.id, type: "browser", allowedReferrers: row.allowedReferrers || [] };

    projectCache.set(apiKey, info);
    return info;
  }

  return null;
};
