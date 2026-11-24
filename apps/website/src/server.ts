import handler from "@tanstack/react-start/server-entry";

// Cloudflare finds Workflow classes by their export name from the Worker's entry module.
export * from "./gen/workflows.ts";

export default {
  fetch: (request) => handler.fetch(request),
} satisfies ExportedHandler<Env>;
