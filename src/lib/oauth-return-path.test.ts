import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { oauthReturnPath } from "./oauth-return-path";
describe("OAuth return paths", () => {
  test("preserves the consent authorization and fragment", () => {
    assert.equal(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#details"), "/.lovable/oauth/consent?authorization_id=abc#details");
  });
  test("rejects external and ambiguous redirects", () => {
    for (const path of ["https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/bad\npath"]) assert.equal(oauthReturnPath(path), "/");
  });
});