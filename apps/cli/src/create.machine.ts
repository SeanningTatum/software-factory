import { assign, fromPromise, setup } from "xstate";

export interface CreatePlan {
  readonly name: string;
  readonly targetDir: string;
  readonly features: ReadonlyArray<string>;
  readonly claude: boolean;
  readonly install: boolean;
  readonly git: boolean;
  /** Values for .dev.vars, asked for when a chosen feature can't work without them. */
  readonly devVars?: Readonly<Record<string, string>>;
}

/** Each step of `create`, run in order; steps the plan turns off are skipped. */
export const createMachine = setup({
  types: {
    input: {} as CreatePlan,
    context: {} as { plan: CreatePlan; features: ReadonlyArray<string>; error: string | undefined },
    events: {} as { type: "START" },
  },
  actors: {
    scaffold: fromPromise<ReadonlyArray<string>, CreatePlan>(() =>
      Promise.reject(new Error("not provided")),
    ),
    install: fromPromise<void, CreatePlan>(() => Promise.reject(new Error("not provided"))),
    migrate: fromPromise<void, CreatePlan>(() => Promise.reject(new Error("not provided"))),
    git: fromPromise<void, CreatePlan>(() => Promise.reject(new Error("not provided"))),
  },
  guards: {
    installs: ({ context }) => context.plan.install,
    hasDatabase: ({ context }) => context.features.includes("db"),
    usesGit: ({ context }) => context.plan.git,
  },
}).createMachine({
  id: "create",
  context: ({ input }) => ({ plan: input, features: [], error: undefined }),
  initial: "ready",
  states: {
    ready: { on: { START: "scaffolding" } },
    scaffolding: {
      invoke: {
        src: "scaffold",
        input: ({ context }) => context.plan,
        onDone: {
          target: "afterScaffold",
          actions: assign({ features: ({ event }) => event.output }),
        },
        onError: {
          target: "failed",
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
    },
    afterScaffold: {
      always: [{ guard: "installs", target: "installing" }, { target: "afterMigrate" }],
    },
    installing: {
      invoke: {
        src: "install",
        input: ({ context }) => context.plan,
        onDone: "afterInstall",
        onError: {
          target: "failed",
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
    },
    afterInstall: {
      always: [{ guard: "hasDatabase", target: "migrating" }, { target: "afterMigrate" }],
    },
    migrating: {
      invoke: {
        src: "migrate",
        input: ({ context }) => context.plan,
        onDone: "afterMigrate",
        onError: {
          target: "failed",
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
    },
    afterMigrate: { always: [{ guard: "usesGit", target: "committing" }, { target: "done" }] },
    committing: {
      invoke: {
        src: "git",
        input: ({ context }) => context.plan,
        onDone: "done",
        onError: {
          target: "failed",
          actions: assign({ error: ({ event }) => String(event.error) }),
        },
      },
    },
    done: { type: "final" },
    failed: { type: "final" },
  },
});
