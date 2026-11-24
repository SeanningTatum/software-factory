import { describe, expect, it } from "vitest";
import { redact, redactText } from "./redact.ts";

describe("redactText", () => {
  it.each([
    ["Authorization: Bearer abc.def.ghi", "[redacted]"],
    ["token=supersecret123", "token=[redacted]"],
    ["postgres://user:pa55@db.example.com/app", "postgres://[redacted]@db.example.com/app"],
    ["key sk_test_4eC39HqLyjWDarjtT1zdp7dc", "[redacted-key]"],
    ["jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_nature", "[redacted-jwt]"],
  ])("removes secrets from %s", (input, expected) => {
    expect(redactText(input)).toContain(expected);
  });

  it("hashes emails the same way every time, ignoring case", () => {
    const a = redactText("signed up: Ada@Example.com");
    const b = redactText("signed up: ada@example.com");
    expect(a).toMatch(/email:[0-9a-f]{16}/);
    expect(a).toBe(b);
    expect(a).not.toContain("example.com");
  });
});

describe("redact", () => {
  it("blanks sensitive keys at any depth and keeps the rest", () => {
    expect(redact({ user: { id: "u1", password: "x" }, headers: { cookie: "a=b" }, n: 3 })).toEqual(
      {
        user: { id: "u1", password: "[redacted]" },
        headers: { cookie: "[redacted]" },
        n: 3,
      },
    );
  });
});
