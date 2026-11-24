import { describe, expect, it } from "vitest";
import { check, MAX_BYTES, sniff } from "./validate.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

describe("sniff", () => {
  it("recognises files by their first bytes", () => {
    expect(sniff(PNG)).toBe("image/png");
    expect(sniff(WEBP)).toBe("image/webp");
  });
  it("does not mistake another RIFF file for WebP", () => {
    expect(sniff(WAV)).toBeUndefined();
  });
});

describe("check", () => {
  it("accepts a real PNG", () =>
    expect(check({ size: 8, type: "image/png" }, PNG)).toBeUndefined());
  it.each([
    [{ size: 0, type: "image/png" }, undefined, "empty"],
    [{ size: MAX_BYTES + 1, type: "image/png" }, undefined, "too_large"],
    [{ size: 8, type: "text/html" }, undefined, "unsupported_type"],
    [{ size: 8, type: "image/jpeg" }, PNG, "type_mismatch"],
  ])("rejects %o", (file, head, reason) => {
    expect(check(file, head)).toBe(reason);
  });
});
