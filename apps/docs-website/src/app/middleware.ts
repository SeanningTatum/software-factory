// cf-saas-lint allow comments
import { env, waitUntil } from "cloudflare:workers";
import { createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { Effect } from "effect";
import { bodyTooLarge } from "./body.ts";
import type { AppEnv } from "./env.ts";
import { parentSpanFor, requestInfoFrom } from "./request.ts";
import { makeRuntime } from "./runtime.ts";
import { makeNonce, securityHeaders } from "./security-headers.ts";

const nonces = new WeakMap<Request, string>();

export const nonceFor = (request: Request) => nonces.get(request);

/**
 * shortcut: a server function call with none of `Sec-Fetch-Site`, `Origin` or `Referer` is refused;
 * allow it only if a non-browser client must call server functions.
 */
export const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const requestRuntime = createMiddleware().server(async ({ next, request }) => {
  const refused = bodyTooLarge(request);
  if (refused) return refused;
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
