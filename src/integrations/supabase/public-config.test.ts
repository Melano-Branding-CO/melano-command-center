import test from "node:test";
import assert from "node:assert/strict";
import { serializeSupabasePublicConfig, validateSupabasePublicConfig } from "./public-config.ts";

const config = { url: "https://example.supabase.co/", publishableKey: "sb_publishable_test" };
const legacyKey = (role: string) =>
  ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "signature"].join(".");

test("runtime public configuration survives HTML serialization without build variables", () => {
  const serialized = serializeSupabasePublicConfig(config);
  assert.deepEqual(validateSupabasePublicConfig(JSON.parse(serialized)), {
    ...config,
    url: "https://example.supabase.co",
  });
});

test("only the public URL and key are serialized", () => {
  const serialized = serializeSupabasePublicConfig({
    ...config,
    serviceRoleKey: "private-canary",
  } as typeof config);
  assert.equal(serialized.includes("private-canary"), false);
  assert.deepEqual(Object.keys(JSON.parse(serialized)), ["url", "publishableKey"]);
});

test("privileged keys cannot be embedded in the page", () => {
  for (const key of ["sb_secret_private", legacyKey("service_role"), "invalid-key"]) {
    assert.throws(
      () => serializeSupabasePublicConfig({ ...config, publishableKey: key }),
      /clave pública/,
    );
  }
  assert.equal(
    validateSupabasePublicConfig({ ...config, publishableKey: legacyKey("anon") }).publishableKey,
    legacyKey("anon"),
  );
});

test("missing configuration and unsafe endpoints fail without exposing values", () => {
  for (const value of [undefined, {}, { url: config.url }])
    assert.throws(() => validateSupabasePublicConfig(value));
  for (const url of [
    "http://remote.example",
    "https://user:private@example.com",
    "https://example.com/?secret=private",
    "https://example.com/#private",
    "https://example.com/path",
  ]) {
    assert.throws(() => serializeSupabasePublicConfig({ ...config, url }));
  }
  assert.equal(
    validateSupabasePublicConfig({ ...config, url: "http://127.0.0.1:54321" }).url,
    "http://127.0.0.1:54321",
  );
});

test("script-breaking input cannot become executable HTML", () => {
  assert.throws(() =>
    serializeSupabasePublicConfig({
      ...config,
      publishableKey: "sb_publishable_</script><script>alert(1)</script>",
    }),
  );
});
