# The Cherrytracer Manifest: Unified Ingest, Split Storage

> "No Bloat" does not mean "One Table". It means "One Interface".

We believe that for indie developers and lean startups, the friction of setting up separate analytics infrastructure (PostHog, Mixpanel) is the enemy. However, the naive approach of dumping everything into a single log stream is fatal for long-term product health.

This manifest outlines our architectural philosophy: **Unified Ingest, Split Storage**.

## The Core Philosophy

1.  **One SDK to Rule Them All:** You should not need a separate SDK for Logging, Tracing, and Analytics. `cherry.track()` and `cherry.info()` should live side-by-side.
2.  **Context is King:** A business event (e.g., "Subscription Failed") is useless without the system context (the stack trace and API latency) that caused it.
3.  **Retention is Not Uniform:** Not all data is created equal.

## The Architecture: Split Storage

We ingest everything through a single high-performance pipeline, but we split the data at the persistence layer based on its **Value Density**.

### 1. The Logs Table (`logs`)
-   **Content:** High-volume, low-value debug data (INFO, DEBUG, traces).
-   **Retention:** **Ephemeral (30 Days).**
-   **Purpose:** Operational debugging. "Why is the server slow right now?"
-   **Characteristics:** Massive size, partitioned by time, aggressively pruned.

### 2. The Events Table (`events`)
-   **Content:** Low-volume, high-value business signals (Signups, MRR, Errors).
-   **Retention:** **Infinite.**
-   **Purpose:** Business intelligence. "How has our conversion rate changed over the last year?"
-   **Characteristics:** Small size, unpartitioned (or yearly), never deleted.

## Advantages

### 1. The Retention Paradox Solved
You can now keep your "User Signup" history for 10 years without paying to store 10 years of "Health Check OK" logs. This is the single biggest advantage. It turns a "toy" logger into a "business" platform.

### 2. Blazing Fast Analytics
Running `SELECT count(*) FROM events` scans a table of millions of rows, not billions. Your dashboard loads instantly, even as your log volume explodes.

### 3. "God Mode" Context
Because Events and Logs share the same `trace_id` and `session_id`, you retain the ability to "drill down". You can click on a 2-year-old "Purchase Failed" event and—if you still have the logs—see the trace. If the logs are gone, you still have the event data.

### 4. Zero Client Bloat
The frontend/backend code remains pristine. No new libraries. No new config. Just `cherry.track()`.
