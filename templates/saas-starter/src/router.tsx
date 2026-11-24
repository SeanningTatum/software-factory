import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { nonceFor } from "./core/middleware.ts";
import { routeTree } from "./routeTree.gen.ts";

const nonce = createIsomorphicFn()
  .server(() => nonceFor(getRequest()))
  .client(() => undefined);

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    ssr: { nonce: nonce() },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
