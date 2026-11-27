// software-factory-lint allow comments
import { assign, fromPromise, setup } from "xstate";

export interface Confirmation {
  readonly email: string;
  readonly code: string;
  readonly password?: string;
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

/** Ask for a code by email, then confirm it. Given an email, the code is already on its way. */
export const codeMachine = setup({
  types: {
    context: {} as { email: string; error: string | undefined },
    input: {} as { email?: string },
    events: {} as
      | { type: "REQUEST"; email: string }
      | { type: "CONFIRM"; code: string; password?: string }
      | { type: "RESEND" }
      | { type: "EDIT" },
  },
  actors: {
    request: fromPromise<void, string>(() => Promise.reject(new Error("request was not provided"))),
    confirm: fromPromise<void, Confirmation>(() =>
      Promise.reject(new Error("confirm was not provided")),
    ),
  },
  guards: { hasEmail: ({ context }) => context.email !== "" },
}).createMachine({
  id: "code",
  context: ({ input }) => ({ email: input.email ?? "", error: undefined }),
  initial: "start",
  on: { EDIT: { actions: assign({ error: undefined }) } },
  states: {
    start: { always: [{ guard: "hasEmail", target: "code" }, { target: "email" }] },
    email: {
      on: {
        REQUEST: {
          target: "requesting",
          actions: assign({ email: ({ event }) => event.email, error: undefined }),
        },
      },
    },
    requesting: {
      invoke: {
        src: "request",
        input: ({ context }) => context.email,
        onDone: "code",
        onError: {
          target: "email",
          actions: assign({ error: ({ event }) => messageOf(event.error) }),
        },
      },
    },
    code: {
      on: {
        CONFIRM: { target: "confirming", actions: assign({ error: undefined }) },
        RESEND: { target: "requesting", actions: assign({ error: undefined }) },
      },
    },
    confirming: {
      invoke: {
        src: "confirm",
        input: ({ context, event }) => {
          const { code, password } = event as { code: string; password?: string };
          return { email: context.email, code, ...(password ? { password } : {}) };
        },
        onDone: "done",
        onError: {
          target: "code",
          actions: assign({ error: ({ event }) => messageOf(event.error) }),
        },
      },
    },
    done: { type: "final" },
  },
});
