import { describe, expect, test } from "bun:test";
import { createMachine, fromPromise, setup } from "xstate";
import { checkMachine, toMermaid } from "./machines.ts";

const good = createMachine({
  id: "upload",
  initial: "idle",
  states: {
    idle: { on: { PICK: "uploading" } },
    uploading: { on: { DONE: "done", FAIL: "failed" } },
    failed: { on: { RETRY: "uploading", RESET: "idle" } },
    done: { type: "final" },
  },
});

describe("checkMachine", () => {
  test("passes a well-formed machine", () => {
    expect(checkMachine(good)).toEqual([]);
  });

  test("finds a state nothing leads to", () => {
    const m = createMachine({
      initial: "a",
      states: { a: { on: { GO: "b" } }, b: { on: { BACK: "a" } }, orphan: { on: { GO: "a" } } },
    });
    expect(checkMachine(m)).toEqual([{ state: "orphan", message: "cannot be reached from the start" }]);
  });

  test("finds a trap state", () => {
    const m = createMachine({ initial: "a", states: { a: { on: { GO: "stuck" } }, stuck: {} } });
    expect(checkMachine(m).map((p) => p.state)).toEqual(["stuck"]);
  });

  test("refuses an initial state that invokes an actor", () => {
    const m = setup({ actors: { load: fromPromise(async () => 1) } }).createMachine({
      initial: "loading",
      states: { loading: { invoke: { src: "load", onDone: "ready" } }, ready: { on: { RELOAD: "loading" } } },
    });
    expect(checkMachine(m)).toContainEqual({
      state: "loading",
      message: "invokes an actor in the initial state; start it from an event instead",
    });
  });

  test("follows nested states and inherited transitions", () => {
    const m = createMachine({
      initial: "form",
      states: {
        form: {
          initial: "editing",
          on: { CANCEL: "#nested.closed" },
          states: { editing: { on: { SUBMIT: "sending" } }, sending: { on: { OK: "#nested.closed" } } },
        },
        closed: { type: "final" },
      },
      id: "nested",
    });
    expect(checkMachine(m)).toEqual([]);
  });
});

describe("toMermaid", () => {
  test("draws states, events and final states", () => {
    const text = toMermaid(good);
    expect(text).toContain("stateDiagram-v2");
    expect(text).toContain("[*] --> idle");
    expect(text).toContain("idle --> uploading : PICK");
    expect(text).toContain("done --> [*]");
  });
});

describe("checkMachine with a transient start", () => {
  test("accepts a cycle among the states the start settles into", () => {
    const m = createMachine({
      initial: "resolving",
      states: {
        resolving: { always: "asking" },
        asking: { on: { YES: "granted" } },
        granted: { on: { REOPEN: "asking" } },
      },
    });
    expect(checkMachine(m)).toEqual([]);
  });
});
