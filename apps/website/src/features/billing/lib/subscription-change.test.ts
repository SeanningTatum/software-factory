import { describe, expect, it } from "vitest";
import { unexpectedChange } from "./subscription-change.ts";

const event = (status?: string) => ({
  data: { previous_attributes: status === undefined ? {} : { status } },
});

describe("unexpectedChange", () => {
  it("flags a change the machine doesn't allow, using the status before the update", () => {
    expect(unexpectedChange(event("canceled"), "active")).toEqual({
      from: "canceled",
      to: "active",
    });
  });
  it("passes a change the machine allows", () => {
    expect(unexpectedChange(event("active"), "past_due")).toBeUndefined();
  });
  it("passes an update that didn't touch the status", () => {
    expect(unexpectedChange(event(), "active")).toBeUndefined();
  });
  it("ignores statuses the machine doesn't model", () => {
    expect(unexpectedChange(event("incomplete_expired"), "active")).toBeUndefined();
  });
});
