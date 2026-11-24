import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Auth } from "#/blocks/auth/auth-service.ts";
import { runResponse } from "#/core/run-effect.ts";

const handle = ({
  request,
  context,
}: {
  request: Request;
  context: Parameters<typeof runResponse>[0];
}) =>
  runResponse(
    context,
    Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* auth.handle(request);
    }),
    "auth.api",
  );

export const Route = createFileRoute("/(auth)/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
