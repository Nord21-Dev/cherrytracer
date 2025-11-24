import { Elysia, t } from "elysia";
import { getProjectKeyInfo } from "../services/auth";
import { ingestQueue } from "../queue";
import { checkReferrer } from "../services/referrer";

type LogEventPayload = {
  level: string;
  message: string;
  traceId?: string;
  spanId?: string;
  data?: Record<string, any>;
  timestamp?: string;
};

type EnvelopePayload = {
  projectId?: string;
  events: LogEventPayload | LogEventPayload[];
};

type IncomingBody = LogEventPayload | LogEventPayload[] | EnvelopePayload;

const logSchema = t.Object({
  level: t.String(),
  message: t.String(),
  traceId: t.Optional(t.String()),
  spanId: t.Optional(t.String()),
  data: t.Optional(t.Any()),
  timestamp: t.Optional(t.String())
});

const envelopeSchema = t.Object({
  projectId: t.Optional(t.String()),
  events: t.Union([
    logSchema,
    t.Array(logSchema)
  ])
});

const normalizeBody = (payload: IncomingBody) => {
  if (Array.isArray(payload)) {
    return { events: payload, hintedProjectId: undefined as string | undefined };
  }

  if (payload && typeof payload === "object" && "events" in payload) {
    const events = Array.isArray(payload.events) ? payload.events : [payload.events];
    return { events, hintedProjectId: payload.projectId };
  }

  if (payload && typeof payload === "object") {
    return { events: [payload as LogEventPayload], hintedProjectId: undefined };
  }

  return { events: [] as LogEventPayload[], hintedProjectId: undefined };
};

const coerceHeader = (value: string | string[] | undefined) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

export const ingestRoutes = new Elysia({ prefix: "/ingest" })
  .post("/", async ({ body, headers, set }) => {
    console.log(headers);
    const apiKey = coerceHeader(headers["x-api-key"]);
    const headerProjectId = coerceHeader(headers["x-project-id"]);
    const refererHeader = coerceHeader(headers["referer"] || headers["referrer"] || headers["Referer"]);

    if (!apiKey) {
      set.status = 401;
      return { error: "Missing x-api-key header" };
    }

    const { events, hintedProjectId } = normalizeBody(body as IncomingBody);
    if (!events.length) {
      set.status = 400;
      return { error: "No log events provided" };
    }

    const claimedProjectId = headerProjectId || hintedProjectId;

    let projectId: string | null = null;
    let keyType: "server" | "browser" | null = null;
    let allowedReferrers: string[] = [];
    try {
      const keyInfo = await getProjectKeyInfo(apiKey);
      if (keyInfo) {
        projectId = keyInfo.projectId;
        keyType = keyInfo.type;
        allowedReferrers = keyInfo.allowedReferrers || [];
      }
    } catch (error) {
      console.error("[Ingest] Project lookup failed", error);
      set.status = 500;
      return { error: "Unable to validate API Key" };
    }

    if (!projectId) {
      set.status = 403;
      return { error: "Invalid API Key" };
    }

    if (keyType === "browser") {
      const refCheck = checkReferrer(refererHeader, allowedReferrers);
      if (!refCheck.allowed) {
        set.status = 403;
        return { error: refCheck.reason || "Referrer not allowed for this browser key" };
      }
    }

    if (claimedProjectId && claimedProjectId !== projectId) {
      set.status = 403;
      return { error: "Project mismatch for provided API Key" };
    }

    const remainingCapacity = ingestQueue.remainingCapacity();
    if (events.length > remainingCapacity) {
      set.status = 429;
      set.headers["Retry-After"] = "1";
      return { error: "Ingest backlog full, retry shortly", queued: 0, dropped: events.length };
    }

    let accepted = 0;
    for (const event of events) {
      const ok = ingestQueue.add({
        projectId,
        traceId: event.traceId || null,
        spanId: event.spanId || null,
        level: event.level || "info",
        message: event.message || "",
        data: event.data || {},
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      });

      if (!ok) {
        set.status = 429;
        set.headers["Retry-After"] = "1";
        return { error: "Ingest backlog full, retry shortly", queued: accepted, dropped: events.length - accepted };
      }

      accepted++;
    }

    return { success: true, projectId, queued: accepted };
  }, {
    detail: {
      summary: "Ingest Logs",
      tags: ["Ingestion"]
    },
    headers: t.Object({
      "x-api-key": t.String({ description: "Your Project API Key" }),
      "x-project-id": t.Optional(t.String({ description: "Optional: Explicit Project ID for validation" })),
      "referer": t.Optional(t.String()),
      "referrer": t.Optional(t.String()),
      "Referer": t.Optional(t.String())
    }, { additionalProperties: true }),
    body: t.Union([
      logSchema,
      t.Array(logSchema),
      envelopeSchema
    ])
  });
