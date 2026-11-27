import { describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { type Confirmation, codeMachine } from "./code.machine.ts";

const start = (
  actors: { request?: () => Promise<void>; confirm?: (c: Confirmation) => Promise<void> },
  email?: string,
) =>
  createActor(
    codeMachine.provide({
      actors: {
        request: fromPromise(actors.request ?? (async () => undefined)),
        confirm: fromPromise<void, Confirmation>(({ input }) =>
          (actors.confirm ?? (async () => undefined))(input),
        ),
      },
    }),
    { input: { ...(email ? { email } : {}) } },
  ).start();

describe("code machine", () => {
  it("asks for the email, sends a code, then confirms it with the new password", async () => {
    let seen: Confirmation | undefined;
    const actor = start({
      confirm: async (c) => {
        seen = c;
      },
    });
    expect(actor.getSnapshot().value).toBe("email");
    actor.send({ type: "REQUEST", email: "a@b.dev" });
    await waitFor(actor, (s) => s.matches("code"));
    actor.send({ type: "CONFIRM", code: "123456", password: "a brand new secret" });
    await waitFor(actor, (s) => s.status === "done");
    expect(seen).toEqual({ email: "a@b.dev", code: "123456", password: "a brand new secret" });
  });

  it("starts at the code when the email is already known, and can resend", async () => {
    let sends = 0;
    const actor = start(
      {
        request: async () => {
          sends += 1;
        },
      },
      "a@b.dev",
    );
    expect(actor.getSnapshot().value).toBe("code");
    actor.send({ type: "RESEND" });
    await waitFor(actor, (s) => s.matches("code"));
    expect(sends).toBe(1);
  });

  it("stays on the email when the code can't be sent", async () => {
    const actor = start({ request: () => Promise.reject(new Error("No mail today")) });
    actor.send({ type: "REQUEST", email: "a@b.dev" });
    await waitFor(actor, (s) => s.matches("email"));
    expect(actor.getSnapshot().context.error).toBe("No mail today");
  });

  it("keeps the code step after a wrong code, and clears the error on edit", async () => {
    const actor = start({ confirm: () => Promise.reject(new Error("Invalid code")) }, "a@b.dev");
    actor.send({ type: "CONFIRM", code: "000000" });
    await waitFor(actor, (s) => s.matches("code") && s.context.error !== undefined);
    actor.send({ type: "EDIT" });
    expect(actor.getSnapshot().context.error).toBeUndefined();
  });
});
