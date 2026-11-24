import { describe, expect, it, vi } from "vitest";
import { nonceFor, requestRuntime } from "./middleware.ts";

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
