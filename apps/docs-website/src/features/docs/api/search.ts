import { Effect } from "effect";
import { createFromSource } from "fumadocs-core/search/server";
import { CloudflareEnv } from "#/app/env.ts";
import { ExternalServiceError } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { checkLimit, clientAddress, type Limiter } from "#/features/core/lib/rate-limit.ts";
import { source } from "#/features/docs/lib/source.ts";

const index = createFromSource(source);

export const searchDocs = Effect.fn("Docs.search")(function* (request: Request) {
  const env = yield* CloudflareEnv;
  yield* checkLimit(binding<Limiter>(env, "SEARCH_LIMITER"), clientAddress(request.headers));
  return yield* outsideCall(
    "docs.search",
    () => index.GET(request),
    (cause) => new ExternalServiceError({ service: "docs-search", cause }),
  );
});
