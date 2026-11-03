import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

function authenticateCronRequest(request: Request): Response | null {
  const currentSecret =
    process.env["CRON_SECRET"] ?? process.env["LOVABLE_CRON_SECRET"];
  const previousSecret = process.env["LOVABLE_CRON_SECRET_PREVIOUS"];

  if (!currentSecret) {
    return new Response("Server configuration error", { status: 500 });
  }

  const match = /^Bearer ([^\s,]+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  const token = match?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const digest = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();
  const providedDigest = digest(token);
  const currentMatches = timingSafeEqual(providedDigest, digest(currentSecret));
  const previousMatches = previousSecret
    ? timingSafeEqual(providedDigest, digest(previousSecret))
    : false;

  if (!currentMatches && !previousMatches) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

async function handle(request: Request) {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { runExecutiveMeetingServer } = await import("@/lib/melano-ai.server");
    const result = await runExecutiveMeetingServer({ trigger: "schedule" });
    return Response.json({
      ok: true,
      meeting_id: result.meetingId,
      trace_id: result.traceId,
      top3_count: result.brief.top3?.length ?? 0,
    });
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
