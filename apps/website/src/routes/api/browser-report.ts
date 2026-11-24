import { createFileRoute } from "@tanstack/react-router";
import { Cause, Effect, ErrorReporter, Schema } from "effect";
import { readBody } from "#/core/body.ts";
import { InvalidInput } from "#/core/errors.ts";
import { runResponse } from "#/core/run-effect.ts";

const MAX_BYTES = 8 * 1024;
const NO_CONTENT = 204;

const Report = Schema.Struct({
  message: Schema.String.check(Schema.isMaxLength(1000)),
  stack: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(4000))),
  path: Schema.String.check(Schema.isMaxLength(512)),
});

/** Errors caught in the browser, sent to the same reporter as server errors. */
export const Route = createFileRoute("/api/browser-report")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
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
            return new Response(null, { status: NO_CONTENT });
          }),
          "browser.report",
        ),
    },
  },
});
