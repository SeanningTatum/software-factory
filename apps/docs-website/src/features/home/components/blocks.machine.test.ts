import { describe, expect, it, vi } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { blocksMachine } from "./blocks.machine.ts";

const start = (write: (text: string) => Promise<void>) =>
  createActor(
    blocksMachine.provide({
      actors: { writeClipboard: fromPromise(({ input }) => write(input.text)) },
    }),
  ).start();

describe("blocks machine", () => {
  it("starts with db and auth, and a toggle follows what blocks need", () => {
    const actor = start(() => Promise.resolve());
    expect(actor.getSnapshot().context.picked).toEqual(["db", "auth"]);
    actor.send({ type: "TOGGLE", name: "billing" });
    actor.send({ type: "TOGGLE", name: "db" });
    expect(actor.getSnapshot().context.picked).toEqual([]);
  });

  it("copies the command for the picked blocks, then goes back to idle", async () => {
    vi.useFakeTimers();
    const written: Array<string> = [];
    const actor = start((text) => Promise.resolve(void written.push(text)));
    actor.send({ type: "TOGGLE", name: "kv" });
    actor.send({ type: "COPY" });
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe("copied"));
    expect(written).toEqual([
      "bunx @seanningtatum/create-software-factory my-app --features db,kv,auth",
    ]);
    vi.runAllTimers();
    expect(actor.getSnapshot().value).toBe("idle");
    vi.useRealTimers();
  });

  it("says so when the browser refuses the clipboard", async () => {
    const actor = start(() => Promise.reject(new Error("denied")));
    actor.send({ type: "COPY" });
    const snapshot = await waitFor(actor, (state) => state.matches("refused"));
    expect(snapshot.value).toBe("refused");
  });
});
