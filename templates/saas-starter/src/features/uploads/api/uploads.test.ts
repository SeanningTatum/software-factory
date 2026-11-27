import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { MAX_FILES_PER_USER, PAGE_SIZE } from "../constants.ts";
import { memoryBucket } from "./memory-bucket.ts";
import { Uploads } from "./uploads.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = (name = "cat.png") => new File([PNG], name, { type: "image/png" });

describe("Uploads", () => {
  it("stores a valid file under the user's prefix and lists it", async () => {
    const { bucket } = memoryBucket();
    const uploads = Uploads.make(bucket, undefined);
    const stored = await Effect.runPromise(uploads.upload("u1", png('my "cat"!.png')));
    expect(stored.id).toMatch(/^\d{13}-[0-9a-f-]{36}$/);
    expect(stored.name).toBe("my _cat_.png");
    const listed = await Effect.runPromise(uploads.list("u1"));
    expect(listed.files.map((f) => f.id)).toEqual([stored.id]);
    expect((await Effect.runPromise(uploads.list("u2"))).files).toEqual([]);
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
    const id = stored.id;
    const mine = await Effect.runPromise(uploads.download("u1", id));
    expect(mine.headers.get("content-type")).toBe("image/png");
    expect(mine.headers.get("content-disposition")).toBe('attachment; filename="cat.png"');
    expect(JSON.stringify(await Effect.runPromiseExit(uploads.download("u2", id)))).toContain(
      "NotFound",
    );
  });

  const seed = (store: ReturnType<typeof memoryBucket>["store"], count: number) => {
    for (let i = 0; i < count; i++) {
      store.set(`users/u1/${String(99_999 - i).padStart(5, "0")}`, {
        bytes: new ArrayBuffer(1),
        contentType: "image/png",
        meta: {
          name: `f${i}.png`,
          uploadedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        },
      });
    }
  };

  it("lists one page at a time and hands back a cursor for the next", async () => {
    const { bucket, store } = memoryBucket();
    seed(store, PAGE_SIZE + 5);
    const uploads = Uploads.make(bucket, undefined);
    const first = await Effect.runPromise(uploads.list("u1"));
    expect(first.files).toHaveLength(PAGE_SIZE);
    expect(first.files[0]?.name).toBe(`f${PAGE_SIZE + 4}.png`);
    expect(first.cursor).toBeDefined();
    const second = await Effect.runPromise(uploads.list("u1", first.cursor));
    expect(second.files).toHaveLength(5);
    expect(second.files.at(-1)?.name).toBe("f0.png");
    expect(second.cursor).toBeUndefined();
  });

  it("names a file so that a later upload lists first", async () => {
    const uploads = Uploads.make(memoryBucket().bucket, undefined);
    const older = await Effect.runPromise(uploads.upload("u1", png()));
    await new Promise((resolve) => setTimeout(resolve, 2));
    const newer = await Effect.runPromise(uploads.upload("u1", png()));
    const { files } = await Effect.runPromise(uploads.list("u1"));
    expect(files.map((f) => f.id)).toEqual([newer.id, older.id]);
  });

  it("refuses an upload once the user holds the most files", async () => {
    const { bucket, store } = memoryBucket();
    seed(store, MAX_FILES_PER_USER);
    const uploads = Uploads.make(bucket, undefined);
    expect(JSON.stringify(await Effect.runPromiseExit(uploads.upload("u1", png())))).toContain(
      "FileLimitReached",
    );
    expect((await Effect.runPromise(uploads.upload("u2", png()))).name).toBe("cat.png");
  });

  it("still uploads when the rate limiter itself is down", async () => {
    const uploads = Uploads.make(memoryBucket().bucket, {
      limit: () => Promise.reject(new Error("limiter down")),
    });
    expect((await Effect.runPromise(uploads.upload("u1", png()))).name).toBe("cat.png");
  });
});
