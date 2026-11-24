import { describe, expect, it } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import { uploadMachine } from "./upload.machine.ts";

const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png", { type: "image/png" });
const html = new File(["<p>"], "a.html", { type: "text/html" });

const start = (upload: () => Promise<void>) =>
  createActor(uploadMachine.provide({ actors: { upload: fromPromise(upload) } })).start();

describe("upload machine", () => {
  it("uploads a valid file", async () => {
    const actor = start(async () => undefined);
    actor.send({ type: "PICK", file: png });
    await waitFor(actor, (s) => s.matches("done"));
    actor.send({ type: "RESET" });
    expect(actor.getSnapshot().value).toBe("idle");
  });

  it("rejects an unsupported file in the browser without uploading", () => {
    let uploads = 0;
    const actor = start(async () => void uploads++);
    actor.send({ type: "PICK", file: html });
    expect(actor.getSnapshot().value).toBe("rejected");
    expect(actor.getSnapshot().context.error).toBe("Upload a PNG, JPEG, GIF, WebP or PDF.");
    expect(uploads).toBe(0);
  });

  it("retries a failed upload with the same file", async () => {
    let calls = 0;
    const actor = start(() =>
      ++calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(),
    );
    actor.send({ type: "PICK", file: png });
    await waitFor(actor, (s) => s.matches("failed"));
    expect(actor.getSnapshot().context.error).toBe("offline");
    actor.send({ type: "RETRY" });
    await waitFor(actor, (s) => s.matches("done"));
    expect(calls).toBe(2);
  });
});
