import { Cause, Effect, ErrorReporter, Schema } from "effect";
import { readBody } from "#/app/body.ts";
import { CloudflareEnv } from "#/app/env.ts";
import { InvalidInput } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { checkLimit, clientAddress, type Limiter } from "#/features/core/lib/rate-limit.ts";

const MAX_BYTES = 8 * 1024;

const Report = Schema.Struct({
  message: Schema.String.check(Schema.isMaxLength(1000)),
  stack: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(4000))),
  path: Schema.String.check(Schema.isMaxLength(512)),
});

/**
 * An error caught in the browser, sent to the same reporter as server errors. Rate-limited per
 * address, so a script can't spend the error tracker's quota.
 */
export const reportBrowserError = Effect.fn("Observability.browserReport")(function* (
  request: Request,
) {
  const env = yield* CloudflareEnv;
  yield* checkLimit(binding<Limiter>(env, "REPORT_LIMITER"), clientAddress(request.headers));
  const body = yield* readBody(request, MAX_BYTES);
  const report = yield* Schema.decodeUnknownEffect(Report)(body).pipe(
    Effect.mapError((issue) => new InvalidInput({ issues: String(issue) })),
  );
  const error = Object.assign(new Error(report.message), {
    name: "BrowserError",
    stack: report.stack,
  });
  yield* Effect.logWarning("browser error", { path: report.path });
  yield* ErrorReporter.report(Cause.die(error));
});
