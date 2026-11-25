import { env, waitUntil } from "cloudflare:workers";
import { createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { Effect } from "effect";
import type { AppEnv } from "./env.ts";
import { parentSpanFor, requestInfoFrom } from "./request.ts";
import { makeRuntime } from "./runtime.ts";
import { makeNonce, securityHeaders } from "./security-headers.ts";

const nonces = new WeakMap<Request, string>();

/** The CSP nonce for a request, so the router can stamp it on the scripts it renders. */
export const nonceFor = (request: Request) => nonces.get(request);

/**
 * Refuses a server function call that comes from another site: Start checks `Sec-Fetch-Site`,
 * then `Origin`, then `Referer` against the request's own origin. API routes (`/api/auth/*`,
 * `/api/events`, webhooks) are not server functions, so the filter leaves them alone.
 * shortcut: a call with none of those headers is refused; allow it only if a non-browser
 * client must call server functions.
 */
export const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

/**
 * Runs for every request: gives it an id and an Effect runtime, adds security headers
 * and `x-request-id`, logs the outcome, then disposes the runtime (which flushes analytics).
 */
export const requestRuntime = createMiddleware().server(async ({ next, request }) => {
  const info = requestInfoFrom(request);
  const nonce = makeNonce();
  nonces.set(request, nonce);
  const runtime = makeRuntime({ env: env as AppEnv, request: info, waitUntil });
  const started = Date.now();

  const result = await next({ context: { runtime, request: info } });

  const response = new Response(result.response.body, result.response);
  response.headers.set("x-request-id", info.id);
  for (const [key, value] of Object.entries(securityHeaders(nonce, import.meta.env.PROD))) {
    if (!response.headers.has(key)) response.headers.set(key, value);
  }
  waitUntil(
    runtime
      .runPromise(
        Effect.logInfo("request").pipe(
          Effect.annotateLogs({ status: response.status, ms: Date.now() - started }),
          Effect.withSpan("http.request", { attributes: { method: info.method, path: info.path } }),
          Effect.withParentSpan(parentSpanFor(info)),
        ),
      )
      .finally(() => runtime.dispose()),
  );
  return { ...result, response };
});
