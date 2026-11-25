import { createStart } from "@tanstack/react-start";
import { csrf, requestRuntime } from "./app/middleware.ts";

export const startInstance = createStart(() => ({
  requestMiddleware: [requestRuntime, csrf],
}));

declare module "@tanstack/react-start" {
  interface Register {
    config: Awaited<ReturnType<typeof startInstance.getOptions>>;
  }
}
