import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { plansFrom } from "./plans.ts";

describe("plansFrom", () => {
  it("offers Pro once its price is set", () => {
    expect(plansFrom({ STRIPE_PRICE_PRO: "price_123" } as unknown as AppEnv)).toEqual([
      { name: "pro", priceId: "price_123", label: "Pro" },
    ]);
  });
  it("offers nothing without a price", () => {
    expect(plansFrom({} as AppEnv)).toEqual([]);
  });
});
