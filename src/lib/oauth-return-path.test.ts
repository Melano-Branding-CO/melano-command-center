import { describe, expect, test } from "bun:test";
import { oauthReturnPath } from "./oauth-return-path";
describe("OAuth return paths", () => {
  test("preserves the consent authorization and fragment", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#details")).toBe("/.lovable/oauth/consent?authorization_id=abc#details");
  });
  test("rejects external and ambiguous redirects", () => {
    for (const path of ["https://outside.invalid", "//outside.invalid", "/\\outside.invalid", "/bad\npath"]) expect(oauthReturnPath(path)).toBe("/");
  });
});