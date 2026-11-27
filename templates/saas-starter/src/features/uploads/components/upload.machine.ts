import { assign, fromPromise, setup } from "xstate";
import { check, type Rejection, rejectionMessage } from "../lib/validate.ts";

/** The browser check is a courtesy; the server checks again, including the file's real bytes. */
export const uploadMachine = setup({
  types: {
    context: {} as { file: File | undefined; error: string | undefined },
    events: {} as { type: "PICK"; file: File } | { type: "RETRY" } | { type: "RESET" },
  },
  actors: {
    upload: fromPromise<void, File>(() => Promise.reject(new Error("upload was not provided"))),
  },
  guards: {
    rejected: ({ context }) => !context.file || check(context.file) !== undefined,
  },
}).createMachine({
  id: "upload",
  context: { file: undefined, error: undefined },
  initial: "idle",
  states: {
    idle: {
      on: {
        PICK: {
          target: "checking",
          actions: assign({ file: ({ event }) => event.file, error: undefined }),
        },
      },
    },
    checking: {
      always: [
        {
          guard: "rejected",
          target: "rejected",
          actions: assign({
            error: ({ context }) =>
              rejectionMessage[(context.file && check(context.file)) || "empty"] as string,
          }),
        },
        { target: "uploading" },
      ],
    },
    uploading: {
      invoke: {
        src: "upload",
        input: ({ context }) => context.file as File,
        onDone: "done",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error ? event.error.message : "Upload failed",
          }),
        },
      },
    },
    rejected: {
      on: {
        PICK: {
          target: "checking",
          actions: assign({ file: ({ event }) => event.file, error: undefined }),
        },
        RESET: "idle",
      },
    },
    failed: {
      on: { RETRY: { target: "uploading", actions: assign({ error: undefined }) }, RESET: "idle" },
    },
    done: { on: { RESET: { target: "idle", actions: assign({ file: undefined }) } } },
  },
});

export type { Rejection };
