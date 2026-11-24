import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { runResponse } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";

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

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
