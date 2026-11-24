import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { CurrentRequest } from "#/core/request.ts";
import { runResponse } from "#/core/run-effect.ts";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const { info } = yield* CurrentRequest;
            return Response.json({ ok: true, requestId: info.id });
          }),
          "health",
        ),
    },
  },
});
