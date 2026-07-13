import { describe, expect, it } from "vitest";

import { getSafeInternalPath } from "../../src/lib/security/safe-redirect";

describe("getSafeInternalPath", () => {
  it("preserves and normalizes a local path with query parameters", () => {
    expect(getSafeInternalPath("/app/inbox?sort=deadline")).toBe(
      "/app/inbox?sort=deadline",
    );
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/\tevil.example/steal",
    "/\nevil.example/steal",
    "/\revil.example/steal",
  ])("rejects unsafe redirect input %j", (value) => {
    expect(getSafeInternalPath(value)).toBe("/app");
  });

  it("uses the caller's trusted fallback for missing input", () => {
    expect(getSafeInternalPath(undefined, "/login")).toBe("/login");
  });
});
