import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { InvalidInput } from "#/app/errors.ts";
import { runResponse } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import { Uploads } from "#/features/uploads/api/uploads.ts";
import { MAX_BYTES } from "#/features/uploads/lib/validate.ts";

const FORM_OVERHEAD = 16 * 1024;
const CREATED = 201;

export const Route = createFileRoute("/api/uploads/")({
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
