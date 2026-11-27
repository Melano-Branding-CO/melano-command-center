import { aiConfiguration, assertAiConfiguration } from "./operational-guards";

export function getAiConfiguration() {
  return aiConfiguration(
    Boolean(process.env["AI_GATEWAY_API_KEY"] || process.env["VERCEL_OIDC_TOKEN"]),
  );
}

export function requireAiConfiguration() {
  assertAiConfiguration(getAiConfiguration().configured);
}
