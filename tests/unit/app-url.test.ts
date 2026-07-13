import { describe, expect, it } from "vitest";

import { getAuthCallbackUrl } from "../../src/lib/security/app-url";

describe("canonical authentication callback URLs", () => {
  it("uses the configured HTTPS origin and normalizes its path", () => {
    expect(
      getAuthCallbackUrl({
        configuredUrl: "https://assistant.example/settings",
        production: true,
      }),
    ).toBe("https://assistant.example/auth/callback");
  });

  it("requires a configured canonical origin in production", () => {
    expect(() =>
      getAuthCallbackUrl({
        production: true,
        requestOrigin: "https://forwarded-host.example",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("requires HTTPS in production, including for loopback hosts", () => {
    expect(() =>
      getAuthCallbackUrl({
        configuredUrl: "http://localhost:3000",
        production: true,
      }),
    ).toThrow(/HTTPS/);
  });

  it("allows an HTTP loopback fallback only during local development", () => {
    expect(
      getAuthCallbackUrl({
        production: false,
        requestOrigin: "http://127.0.0.1:3000",
      }),
    ).toBe("http://127.0.0.1:3000/auth/callback");

    expect(
      getAuthCallbackUrl({
        production: false,
        requestOrigin: "https://untrusted-forwarded-host.example",
      }),
    ).toBeUndefined();
  });

  it("rejects credentials embedded in an application URL", () => {
    expect(() =>
      getAuthCallbackUrl({
        configuredUrl: "https://user:secret@assistant.example",
        production: true,
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
