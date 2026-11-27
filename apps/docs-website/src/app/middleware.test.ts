import { describe, expect, it, vi } from "vitest";
import { csrf, nonceFor, requestRuntime } from "./middleware.ts";

type Server = (options: {
  request: Request;
  context: unknown;
  next: (ctx?: { context: Record<string, unknown> }) => Promise<{ response: Response }>;
}) => Promise<{ response: Response }>;

const server = (requestRuntime as unknown as { options: { server: Server } }).options.server;

describe("requestRuntime", () => {
  it("gives the request an id, a runtime and security headers", async () => {
    const request = new Request("https://x.dev/", {
      headers: { "cf-ray": "8f1e2d3c4b5a6978-SJC" },
    });
    const next = vi.fn(async (ctx?: { context: Record<string, unknown> }) => {
      expect(ctx?.context.runtime).toBeDefined();
      expect(ctx?.context.request).toMatchObject({ id: "8f1e2d3c4b5a6978-SJC", path: "/" });
      return { response: new Response("ok") };
    });
    const { response } = await server({ request, context: {}, next });
    expect(next).toHaveBeenCalledOnce();
    expect(response.headers.get("x-request-id")).toBe("8f1e2d3c4b5a6978-SJC");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(nonceFor(request)).toEqual(expect.any(String));
  });

  it("answers 413 to a huge body without calling the route", async () => {
    const next = vi.fn(async () => ({ response: new Response("ok") }));
    const request = new Request("https://x.dev/api/auth/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(100 * 1024 * 1024) },
    });
    const result = await server({ request, context: {}, next });
    expect((result as unknown as Response).status).toBe(413);
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps a header the route already set", async () => {
    const next = async () => ({
      response: new Response("ok", { headers: { "x-frame-options": "SAMEORIGIN" } }),
    });
    const { response } = await server({
      request: new Request("https://x.dev/"),
      context: {},
      next,
    });
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});

type Csrf = (options: {
  request: Request;
  handlerType: string;
  next: () => unknown;
}) => Promise<unknown> | unknown;

const guard = (csrf as unknown as { options: { server: Csrf } }).options.server;
const call = (url: string, headers: Record<string, string>, handlerType = "serverFn") => {
  const next = vi.fn(() => "passed");
  const out = guard({ request: new Request(url, { method: "POST", headers }), handlerType, next });
  return Promise.resolve(out).then((result) => ({ result, passed: next.mock.calls.length === 1 }));
};

describe("csrf", () => {
  const url = "https://x.dev/_serverFn/abc";

  it("lets a same-origin server function call through", async () => {
    expect((await call(url, { "sec-fetch-site": "same-origin" })).passed).toBe(true);
    expect((await call(url, { origin: "https://x.dev" })).passed).toBe(true);
  });

  it("refuses a server function call from another origin", async () => {
    const cases: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      { origin: "https://evil.dev" },
      { referer: "https://evil.dev/page" },
    ];
    for (const headers of cases) {
      const { result, passed } = await call(url, headers);
      expect(passed).toBe(false);
      expect((result as Response).status).toBe(403);
    }
  });

  it("leaves API routes such as webhooks and auth alone", async () => {
    const { passed } = await call(
      "https://x.dev/api/auth/sign-in",
      { "sec-fetch-site": "cross-site" },
      "router",
    );
    expect(passed).toBe(true);
  });
});
