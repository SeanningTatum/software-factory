import { describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { credentialsMachine } from "./credentials.machine.ts";

const credentials = { email: "a@b.dev", password: "correct horse battery" };

const start = (submit: () => Promise<void>) =>
  createActor(credentialsMachine.provide({ actors: { submit: fromPromise(submit) } })).start();

describe("credentials machine", () => {
  it("finishes when the server accepts", async () => {
    const actor = start(async () => undefined);
    actor.send({ type: "SUBMIT", credentials });
    expect(actor.getSnapshot().value).toBe("submitting");
    await waitFor(actor, (s) => s.status === "done");
    expect(actor.getSnapshot().value).toBe("done");
  });

  it("shows the server's message and clears it on edit", async () => {
    const actor = start(() => Promise.reject(new Error("Invalid email or password")));
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context.error).toBe("Invalid email or password");
    actor.send({ type: "EDIT" });
    expect(actor.getSnapshot()).toMatchObject({ value: "idle", context: { error: undefined } });
  });

  it("can retry straight from a failure", async () => {
    let calls = 0;
    const actor = start(() =>
      ++calls === 1 ? Promise.reject(new Error("no")) : Promise.resolve(),
    );
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.matches("failed"));
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.status === "done");
    expect(calls).toBe(2);
  });
});
