import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { memoryBucket } from "./memory-bucket.ts";
import { prefixFor, Uploads } from "./uploads.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = (name = "cat.png") => new File([PNG], name, { type: "image/png" });

describe("Uploads", () => {
  it("stores a valid file under the user's prefix and lists it", async () => {
    const { bucket } = memoryBucket();
    const uploads = Uploads.make(bucket, undefined);
    const stored = await Effect.runPromise(uploads.upload("u1", png("my cat!.png")));
    expect(stored.key.startsWith(prefixFor("u1"))).toBe(true);
    expect(stored.name).toBe("my cat_.png");
    const listed = await Effect.runPromise(uploads.list("u1"));
    expect(listed.map((f) => f.key)).toEqual([stored.key]);
    expect(await Effect.runPromise(uploads.list("u2"))).toEqual([]);
  });

  it("rejects a file whose bytes don't match its type", async () => {
    const fake = new File(["<html>"], "x.png", { type: "image/png" });
    const exit = await Effect.runPromiseExit(
      Uploads.make(memoryBucket().bucket, undefined).upload("u1", fake),
    );
    expect(JSON.stringify(exit)).toContain("type_mismatch");
  });

  it("refuses once the user is over the rate limit", async () => {
    const uploads = Uploads.make(memoryBucket().bucket, {
      limit: async () => ({ success: false }),
    });
    expect(JSON.stringify(await Effect.runPromiseExit(uploads.upload("u1", png())))).toContain(
      "RateLimited",
    );
  });

  it("only serves a file to its owner", async () => {
    const { bucket } = memoryBucket();
    const uploads = Uploads.make(bucket, undefined);
    const stored = await Effect.runPromise(uploads.upload("u1", png()));
    const id = stored.key.slice(prefixFor("u1").length);
    const mine = await Effect.runPromise(uploads.download("u1", id));
    expect(mine.headers.get("content-type")).toBe("image/png");
    expect(JSON.stringify(await Effect.runPromiseExit(uploads.download("u2", id)))).toContain(
      "NotFound",
    );
  });
});
