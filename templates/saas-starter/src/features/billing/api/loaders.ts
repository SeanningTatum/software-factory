import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { Billing } from "./billing-service.ts";

export const getBilling = createServerFn({ method: "GET" }).handler(({ context }) =>
  runEffect(
    context,
    Effect.gen(function* () {
      const auth = yield* Auth;
      const user = yield* auth.requireUser;
      const billing = yield* Billing;
      return yield* billing.stateFor(user.id);
    }),
    "billing.state",
  ),
);
