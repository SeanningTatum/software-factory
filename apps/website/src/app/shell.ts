import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { optedOutFrom, readConsent } from "#/features/consent/lib/consent.ts";
import { runEffect } from "./run-effect.ts";
import { currentViewer } from "./viewer.ts";

/** Everything the page shell needs on first render, so nothing flashes once the page hydrates. */
export const getShell = createServerFn({ method: "GET" }).handler(({ context }) => {
  const request = getRequest();
  return runEffect(
    context,
    Effect.gen(function* () {
      const viewer = yield* currentViewer;
      return {
        viewer,
        consent: {
          stored: readConsent(request.headers.get("cookie")),
          optedOut: optedOutFrom(request.headers),
        },
      };
    }),
    "shell",
  );
});
