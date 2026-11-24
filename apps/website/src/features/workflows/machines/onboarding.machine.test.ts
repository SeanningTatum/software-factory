import { describe, expect, it } from "vitest";
import { stepOrder } from "./onboarding.machine.ts";

describe("onboarding machine", () => {
  it("lists the steps in order", () => {
    expect(stepOrder()).toEqual(["welcome", "wait", "nudge"]);
  });
});
