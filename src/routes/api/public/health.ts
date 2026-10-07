import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        let database: "ok" | "degraded" | "not_configured" = "not_configured";
        if (url && key) {
          try {
            const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
            database = res.ok ? "ok" : "degraded";
          } catch {
            database = "degraded";
          }
        }
        return Response.json(
          {
            status: database === "ok" ? "ok" : "degraded",
            database,
            latency_ms: Date.now() - started,
            checked_at: new Date().toISOString(),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
