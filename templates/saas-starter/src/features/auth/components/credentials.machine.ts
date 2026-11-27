import { assign, fromPromise, setup } from "xstate";
import { ChallengeRequired } from "../errors.ts";

export interface Credentials {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
  readonly captcha?: string;
}

export const credentialsMachine = setup({
  types: {
    context: {} as { error: string | undefined; challenged: boolean },
    events: {} as { type: "SUBMIT"; credentials: Credentials } | { type: "EDIT" },
  },
  actors: {
    submit: fromPromise<void, Credentials>(() =>
      Promise.reject(new Error("submit was not provided")),
    ),
  },
}).createMachine({
  id: "credentials",
  context: { error: undefined, challenged: false },
  initial: "idle",
  states: {
    idle: {
      on: { SUBMIT: "submitting" },
    },
    submitting: {
      invoke: {
        src: "submit",
        input: ({ event }) => (event as { credentials: Credentials }).credentials,
        onDone: "done",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error ? event.error.message : "Something went wrong",
            challenged: ({ context, event }) =>
              context.challenged || event.error instanceof ChallengeRequired,
          }),
        },
      },
    },
    failed: {
      on: {
        SUBMIT: { target: "submitting", actions: assign({ error: undefined }) },
        EDIT: { target: "idle", actions: assign({ error: undefined }) },
      },
    },
    done: { type: "final" },
  },
});
