/** Stand-in for the `cloudflare:workers` module when tests run outside workerd. */
export const env: Record<string, unknown> = {};

export const waitUntil = (promise: Promise<unknown>) => {
  void promise;
};

export class WorkflowEntrypoint<E = unknown, P = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: E,
  ) {}
  declare readonly params: P;
}
