import { describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { ChallengeRequired, credentialsMachine } from "./credentials.machine.ts";

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

  it("hands the Turnstile token to submit", async () => {
    let seen: unknown;
    const actor = createActor(
      credentialsMachine.provide({
        actors: {
          submit: fromPromise(({ input }) => {
            seen = input;
            return Promise.resolve();
          }),
        },
      }),
    ).start();
    actor.send({ type: "SUBMIT", credentials: { ...credentials, captcha: "tok" } });
    await waitFor(actor, (s) => s.status === "done");
    expect(seen).toMatchObject({ captcha: "tok" });
  });

  it("shows the server's message and clears it on edit", async () => {
    const actor = start(() => Promise.reject(new Error("Invalid email or password")));
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context.error).toBe("Invalid email or password");
    actor.send({ type: "EDIT" });
    expect(actor.getSnapshot()).toMatchObject({ value: "idle", context: { error: undefined } });
  });

  it("keeps asking for the bot check once the server wants one", async () => {
    let calls = 0;
    const actor = start(() =>
      Promise.reject(
        ++calls === 1 ? new ChallengeRequired("Confirm you're a person") : new Error("no"),
      ),
    );
    expect(actor.getSnapshot().context.challenged).toBe(false);
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context).toEqual({
      error: "Confirm you're a person",
      challenged: true,
    });
    actor.send({ type: "EDIT" });
    actor.send({ type: "SUBMIT", credentials });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context).toEqual({ error: "no", challenged: true });
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
