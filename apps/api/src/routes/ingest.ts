import { Elysia, t } from "elysia";
import { getProjectIdFromKey } from "../services/auth";
import { ingestQueue } from "../queue";

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
    const apiKey = coerceHeader(headers["x-api-key"]);
    const headerProjectId = coerceHeader(headers["x-project-id"]);

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
    try {
      projectId = await getProjectIdFromKey(apiKey);
    } catch (error) {
      console.error("[Ingest] Project lookup failed", error);
      set.status = 500;
      return { error: "Unable to validate API Key" };
    }

    if (!projectId) {
      set.status = 403;
      return { error: "Invalid API Key" };
    }

    if (claimedProjectId && claimedProjectId !== projectId) {
      set.status = 403;
      return { error: "Project mismatch for provided API Key" };
    }

    for (const event of events) {
      ingestQueue.add({
        projectId,
        traceId: event.traceId || null,
        spanId: event.spanId || null,
        level: event.level || "info",
        message: event.message || "",
        data: event.data || {},
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      });
    }

    return { success: true, projectId, queued: events.length };
  }, {
    detail: {
      summary: "Ingest Logs",
      tags: ["Ingestion"]
    },
    headers: t.Object({
      "x-api-key": t.String({ description: "Your Project API Key" }),
      "x-project-id": t.Optional(t.String({ description: "Optional: Explicit Project ID for validation" }))
    }),
    body: t.Union([
      logSchema,
      t.Array(logSchema),
      envelopeSchema
    ])
  });