import { describe, expect, it } from "vitest";
import { getShortestPaths } from "xstate/graph";
import {
  isEntitled,
  isExpectedChange,
  isStatus,
  subscriptionMachine,
} from "./subscription.machine.ts";

describe("subscription lifecycle", () => {
  it.each([
    ["none", "active", true],
    ["active", "past_due", true],
    ["past_due", "active", true],
    ["trialing", "active", true],
    ["active", "active", true],
    ["canceled", "active", false],
    ["none", "past_due", false],
    ["active", "none", false],
  ] as const)("%s → %s expected: %s", (from, to, expected) => {
    expect(isExpectedChange(from, to)).toBe(expected);
  });

  it("reaches canceled from every status", () => {
    const paths = getShortestPaths(subscriptionMachine);
    expect(paths.map((p) => p.state.value).sort()).toEqual(
      ["active", "canceled", "incomplete", "none", "past_due", "trialing", "unpaid"].sort(),
    );
  });

  it("only active and trialing are paid", () => {
    expect(isEntitled("active")).toBe(true);
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("past_due")).toBe(false);
  });

  it("recognises Stripe's statuses", () => {
    expect(isStatus("past_due")).toBe(true);
    expect(isStatus("paused")).toBe(false);
  });
});
