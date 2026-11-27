import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { type ConsentInput, consentMachine } from "./consent.machine.ts";

const start = (input: ConsentInput) => {
  const persisted: Array<string> = [];
  const actor = createActor(
    consentMachine.provide({
      actions: { persist: (_, params) => void persisted.push(params.choice) },
    }),
    { input },
  ).start();
  return { actor, persisted };
};

describe("consent machine", () => {
  it.each([
    [{ stored: undefined, optedOut: false }, "asking"],
    [{ stored: "granted" as const, optedOut: false }, "granted"],
    [{ stored: "denied" as const, optedOut: false }, "denied"],
    [{ stored: "granted" as const, optedOut: true }, "blocked"],
  ])("starts from %o in %s", (input, state) => {
    expect(start(input).actor.getSnapshot().value).toBe(state);
  });

  it("saves the choice once the visitor answers", () => {
    const { actor, persisted } = start({ stored: undefined, optedOut: false });
    actor.send({ type: "ACCEPT" });
    expect(actor.getSnapshot().value).toBe("granted");
    actor.send({ type: "REOPEN" });
    actor.send({ type: "DECLINE" });
    expect(persisted).toEqual(["granted", "denied"]);
  });

  it("reaches every state by some path", () => {
    const reached = new Set<string>();
    for (const input of [
      { stored: undefined, optedOut: false },
      { stored: undefined, optedOut: true },
    ] satisfies Array<ConsentInput>) {
      for (const path of getShortestPaths(consentMachine, {
        input,
        events: [{ type: "ACCEPT" }, { type: "DECLINE" }, { type: "REOPEN" }],
      })) {
        reached.add(String(path.state.value));
      }
    }
    expect([...reached].sort((a, b) => a.localeCompare(b))).toEqual([
      "asking",
      "blocked",
      "denied",
      "granted",
    ]);
  });
});
