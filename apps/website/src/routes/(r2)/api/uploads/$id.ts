import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Auth } from "#/blocks/auth/auth-service.ts";
import { Uploads } from "#/blocks/r2/uploads.ts";
import { runResponse } from "#/core/run-effect.ts";

const NO_CONTENT = 204;

export const Route = createFileRoute("/(r2)/api/uploads/$id")({
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
