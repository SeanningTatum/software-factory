import { createStart } from "@tanstack/react-start";
import { requestRuntime } from "./core/middleware.ts";

export const startInstance = createStart(() => ({
  requestMiddleware: [requestRuntime],
}));

declare module "@tanstack/react-start" {
  interface Register {
    config: Awaited<ReturnType<typeof startInstance.getOptions>>;
  }
}
