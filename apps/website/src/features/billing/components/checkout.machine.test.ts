import { describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { type CheckoutAction, checkoutMachine } from "./checkout.machine.ts";

const start = (redirect: (action: CheckoutAction) => Promise<void>) =>
  createActor(
    checkoutMachine.provide({ actors: { redirect: fromPromise(({ input }) => redirect(input)) } }),
  ).start();

describe("checkout machine", () => {
  it("leaves for Stripe with the chosen plan", async () => {
    const seen: Array<CheckoutAction> = [];
    const actor = start(async (action) => void seen.push(action));
    actor.send({ type: "START", action: { kind: "upgrade", plan: "pro" } });
    await waitFor(actor, (s) => s.status === "done");
    expect(seen).toEqual([{ kind: "upgrade", plan: "pro" }]);
  });

  it("retries the same action after a failure", async () => {
    const seen: Array<CheckoutAction> = [];
    let calls = 0;
    const actor = start((action) => {
      seen.push(action);
      return ++calls === 1 ? Promise.reject(new Error("Stripe is down")) : Promise.resolve();
    });
    actor.send({ type: "START", action: { kind: "manage" } });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context.error).toBe("Stripe is down");
    actor.send({ type: "RETRY" });
    await waitFor(actor, (s) => s.status === "done");
    expect(seen).toEqual([{ kind: "manage" }, { kind: "manage" }]);
  });

  it("can be dismissed back to idle", async () => {
    const actor = start(() => Promise.reject(new Error("no")));
    actor.send({ type: "START", action: { kind: "manage" } });
    await waitFor(actor, (s) => s.matches("failed"));
    actor.send({ type: "DISMISS" });
    expect(actor.getSnapshot().value).toBe("idle");
  });
});
