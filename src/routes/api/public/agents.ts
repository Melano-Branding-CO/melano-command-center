import { createFileRoute } from "@tanstack/react-router";

// Proxy al worker de agentes. Exige el mismo token del worker; no expone datos sin él.
export const Route = createFileRoute("/api/public/agents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const workerUrl = process.env["AGENT_WORKER_URL"];
        const token = process.env["AGENT_WORKER_TOKEN"];
        const checked_at = new Date().toISOString();
        if (!workerUrl || !token) {
          return Response.json({ status: "not_configured", agents: [], checked_at }, { status: 503 });
        }
        if (request.headers.get("authorization") !== `Bearer ${token}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const started = Date.now();
        try {
          const res = await fetch(`${workerUrl.replace(/\/$/, "")}/agents`, {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
          const body = (await res.json().catch(() => null)) as { agents?: unknown[] } | null;
          return Response.json(
            { status: res.ok ? "ok" : "degraded", agents: body?.agents ?? [], latency_ms: Date.now() - started, checked_at },
            { status: res.ok ? 200 : 502, headers: { "cache-control": "no-store" } },
          );
        } catch {
          return Response.json({ status: "degraded", agents: [], latency_ms: Date.now() - started, checked_at }, { status: 502 });
        }
      },
    },
  },
});
