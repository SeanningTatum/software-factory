import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { requestInfoFrom } from "#/app/request.ts";
import { alertRequest, makeAlerter, selectSender, sentryRequest } from "./error-reporter.ts";

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

describe("alerts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts a burst of errors to the webhook once, then again after five quiet minutes", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    let clock = 0;
    const alerter = makeAlerter(() => clock);
    const env = { ERROR_REPORTER: "none", ALERT_WEBHOOK_URL: "https://hooks.example/a" };
    const send = selectSender(env as unknown as AppEnv, () => undefined, alerter);
    for (let i = 0; i < 20; i++) send(report);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock = 5 * 60 * 1000;
    send(report);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends no alert without a webhook", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    selectSender({ ERROR_REPORTER: "none" } as unknown as AppEnv, () => undefined)(report);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never alerts on a browser report, so a public caller cannot silence real errors", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerter = makeAlerter(() => 0);
    const browser = { ...report, error: Object.assign(new Error("x"), { name: "BrowserError" }) };
    alerter("https://hooks.example/a", browser, () => undefined);
    alerter("https://hooks.example/a", report, () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries again on the next error when the webhook refused the last one", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerter = makeAlerter(() => 0);
    const pending: Array<Promise<unknown>> = [];
    alerter("https://hooks.example/a", report, (p) => void pending.push(p));
    await Promise.all(pending);
    alerter("https://hooks.example/a", report, () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a webhook setting that is not a URL", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const env = { ERROR_REPORTER: "none", ALERT_WEBHOOK_URL: "hooks.example/a" };
    selectSender(
      env as unknown as AppEnv,
      () => undefined,
      makeAlerter(() => 0),
    )(report);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps the text and turns mentions off", async () => {
    const long = { ...report, error: new Error("x".repeat(5000)) };
    const body = JSON.parse(await alertRequest("https://hooks.example/a", long).text());
    expect(body.text.length).toBeLessThanOrEqual(1500);
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("names the request and redacts the message", async () => {
    const body = JSON.parse(await alertRequest("https://hooks.example/a", report).text());
    expect(body.text).toContain(request.id);
    expect(body.text).not.toContain("example.com");
    expect(body.content).toBe(body.text);
  });
});
