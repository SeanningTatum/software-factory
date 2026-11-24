import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Auth } from "#/blocks/auth/auth-service.ts";
import { Uploads } from "#/blocks/r2/uploads.ts";
import { MAX_BYTES } from "#/blocks/r2/validate.ts";
import { Analytics } from "#/core/analytics/analytics.ts";
import { InvalidInput } from "#/core/errors.ts";
import { runResponse } from "#/core/run-effect.ts";

const FORM_OVERHEAD = 16 * 1024;
const CREATED = 201;

export const Route = createFileRoute("/(r2)/api/uploads/")({
  server: {
    handlers: {
      /** Upload one file as multipart form data under the field "file". */
      POST: ({ request, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const user = yield* (yield* Auth).requireUser;
            if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + FORM_OVERHEAD) {
              return yield* new InvalidInput({ issues: "file too large" });
            }
            const form = yield* Effect.tryPromise({
              try: () => request.formData(),
              catch: () => new InvalidInput({ issues: "expected multipart form data" }),
            }).pipe(Effect.withSpan("uploads.readForm"));
            const file = form.get("file");
            if (!(file instanceof File)) return yield* new InvalidInput({ issues: "missing file" });
            const stored = yield* (yield* Uploads).upload(user.id, file);
            yield* (yield* Analytics).capture({
              _tag: "file_uploaded",
              contentType: stored.contentType,
              sizeBytes: stored.size,
            });
            return Response.json(stored, { status: CREATED });
          }),
          "uploads.create",
        ),
      GET: ({ context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const user = yield* (yield* Auth).requireUser;
            return Response.json(yield* (yield* Uploads).list(user.id));
          }),
          "uploads.list",
        ),
    },
  },
});
