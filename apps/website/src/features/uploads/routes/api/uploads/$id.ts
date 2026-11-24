import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { runResponse } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { Uploads } from "#/features/uploads/api/uploads.ts";

const NO_CONTENT = 204;

export const Route = createFileRoute("/api/uploads/$id")({
  server: {
    handlers: {
      GET: ({ params, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const user = yield* (yield* Auth).requireUser;
            return yield* (yield* Uploads).download(user.id, params.id);
          }),
          "uploads.download",
        ),
      DELETE: ({ params, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const user = yield* (yield* Auth).requireUser;
            yield* (yield* Uploads).remove(user.id, params.id);
            return new Response(null, { status: NO_CONTENT });
          }),
          "uploads.remove",
        ),
    },
  },
});
