import { aiHttpError, assertAiConfiguration } from "./operational-guards.ts";

export const AI_MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";

export async function requestAiCompletion(
  system: string,
  user: string,
  credential: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  assertAiConfiguration(Boolean(credential));
  const started = Date.now();
  let response: Response;
  try {
    response = await fetcher(GATEWAY, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new Error(
      "BLOQUEO: IA sin respuesta dentro del plazo o error de conexión. Revisá el servicio antes de reintentar.",
    );
  }
  if (!response.ok) throw new Error(aiHttpError(response.status));
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      "BLOQUEO: la IA no devolvió un resultado válido; la ejecución no se considera exitosa.",
    );
  }
  return {
    text,
    tokens: Number.isFinite(body.usage?.total_tokens) ? Math.max(0, body.usage!.total_tokens!) : 0,
    model: AI_MODEL,
    ms: Date.now() - started,
  };
}
