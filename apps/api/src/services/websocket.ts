import type { ServerWebSocket } from "bun";

const subscribers = new Map<string, Set<ServerWebSocket<any>>>();

export const websocketService = {
    join(projectId: string, ws: ServerWebSocket<any>) {
        if (!subscribers.has(projectId)) {
            subscribers.set(projectId, new Set());
        }
        // Safety: Limit max subscribers per project to prevent memory explosion
        const set = subscribers.get(projectId)!;
        if (set.size > 100) {
            console.warn(`[WS] High subscriber count for ${projectId}`);
        }
        set.add(ws);
    },

    leave(projectId: string, ws: ServerWebSocket<any>) {
        const projectSubs = subscribers.get(projectId);
        if (projectSubs) {
            projectSubs.delete(ws);
            if (projectSubs.size === 0) {
                subscribers.delete(projectId);
            }
        }
    },

    broadcast(projectId: string, type: 'new_logs' | 'stats_update', data: any) {
        const projectSubs = subscribers.get(projectId);
        if (!projectSubs) return;

        const message = JSON.stringify({ type, ...data });
        
        // Iterate and prune dead connections actively
        for (const ws of projectSubs) {
            // readyState 1 = OPEN
            if (ws.readyState === 1) {
                ws.send(message);
            } else {
                // Self-healing: Remove dead socket immediately
                projectSubs.delete(ws);
            }
        }
        
        if (projectSubs.size === 0) {
            subscribers.delete(projectId);
        }
    }
};