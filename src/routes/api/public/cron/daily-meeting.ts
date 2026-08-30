import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

async function handle(request: Request) {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { runExecutiveMeetingServer } = await import("@/lib/melano-ai.server");
    const result = await runExecutiveMeetingServer({ trigger: "schedule" });
    return Response.json({ ok: true, meetingId: result.meetingId, traceId: result.traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron:daily-meeting]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/cron/daily-meeting")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
});
