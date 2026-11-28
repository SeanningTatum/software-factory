import { assign, fromPromise, setup } from "xstate";
import { type BlockName, commandFor, toggleBlock } from "../lib/blocks.ts";

const SHOW_RESULT_MS = 1600;

export const blocksMachine = setup({
  types: {
    context: {} as { picked: ReadonlyArray<BlockName> },
    events: {} as { type: "TOGGLE"; name: BlockName } | { type: "COPY" },
  },
  actors: {
    writeClipboard: fromPromise<void, { text: string }>(() => Promise.resolve()),
  },
}).createMachine({
  id: "blocks",
  context: { picked: ["db", "auth"] },
  initial: "idle",
  on: {
    TOGGLE: {
      actions: assign({ picked: ({ context, event }) => toggleBlock(context.picked, event.name) }),
    },
  },
  states: {
    idle: { on: { COPY: "copying" } },
    copying: {
      invoke: {
        src: "writeClipboard",
        input: ({ context }) => ({ text: commandFor(context.picked) }),
        onDone: "copied",
        onError: "refused",
      },
    },
    copied: { after: { [SHOW_RESULT_MS]: "idle" } },
    refused: { after: { [SHOW_RESULT_MS]: "idle" } },
  },
});
