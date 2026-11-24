import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { runEffect } from "#/core/run-effect.ts";
import { Auth } from "./auth-service.ts";

const getUser = createServerFn({ method: "GET" }).handler(({ context }) =>
  runEffect(
    context,
    Effect.gen(function* () {
      const auth = yield* Auth;
      return (yield* auth.currentUser) ?? null;
    }),
    "auth.guard",
  ),
);

/**
 * For a page's `beforeLoad`: sends signed-out visitors to /login and gives the page the user.
 * Server functions still check the session themselves; this only decides what to render.
 */
export const ensureSignedIn = async ({ location }: { location: { href: string } }) => {
  const user = await getUser();
  if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
  return { user };
};
