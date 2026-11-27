import { describe, expect, it } from "vitest";
import { workerVersion } from "./version.ts";

describe("workerVersion", () => {
  it("gives the id and the release tag", () => {
    const env = { CF_VERSION_METADATA: { id: "abc", tag: "v1.2.0", timestamp: "t" } };
    expect(workerVersion(env)).toEqual({ id: "abc", tag: "v1.2.0" });
  });

  it("leaves the tag out of an untagged deploy", () => {
    expect(workerVersion({ CF_VERSION_METADATA: { id: "abc", tag: "" } })).toEqual({ id: "abc" });
  });

  it("is undefined without the binding, or in local dev where the id is blank", () => {
    expect(workerVersion({})).toBeUndefined();
    expect(workerVersion({ CF_VERSION_METADATA: { id: "", tag: "" } })).toBeUndefined();
  });
});
