import { describe, expect, it } from "vitest";
import type { AppEnv } from "./env.ts";
import { selectSender, sentryRequest } from "./error-reporter.ts";
import { requestInfoFrom } from "./request.ts";

const request = { ...requestInfoFrom(new Request("https://x.dev/p")), userId: "u1" };
const report = { error: new Error("failed for ada@example.com"), severity: "Error", request };

describe("sentryRequest", () => {
  it("posts a redacted envelope to the DSN's project", async () => {
    const req = sentryRequest("https://pubkey@o1.ingest.sentry.io/42", report);
    expect(req?.url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    expect(req?.headers.get("x-sentry-auth")).toContain("sentry_key=pubkey");
    const body = (await req?.text()) ?? "";
    expect(body).toContain(request.id);
    expect(body).not.toContain("example.com");
  });

  it("refuses a malformed DSN", () => {
    expect(sentryRequest("not-a-dsn", report)).toBeUndefined();
  });
});

describe("selectSender", () => {
  it("sends nothing when turned off", () => {
    let waited = 0;
    selectSender({ ERROR_REPORTER: "none" } as unknown as AppEnv, () => waited++)(report);
    expect(waited).toBe(0);
  });

  it("uses Sentry only when a DSN is set", () => {
    let waited = 0;
    const env = {
      ERROR_REPORTER: "sentry",
      SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
    } as unknown as AppEnv;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response(null, { status: 200 }))) as unknown as typeof fetch;
    selectSender(env, () => waited++)(report);
    globalThis.fetch = originalFetch;
    expect(waited).toBe(1);
  });
});
