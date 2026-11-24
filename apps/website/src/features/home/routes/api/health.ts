import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { CurrentRequest } from "#/app/request.ts";
import { runResponse } from "#/app/run-effect.ts";

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
