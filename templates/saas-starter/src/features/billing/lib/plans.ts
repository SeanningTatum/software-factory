import { type AppEnv, setting } from "#/app/env.ts";

export interface Plan {
  readonly name: string;
  readonly priceId: string;
  readonly label: string;
}

export const plansFrom = (env: AppEnv): ReadonlyArray<Plan> => {
  const pro = setting(env, "STRIPE_PRICE_PRO");
  return pro ? [{ name: "pro", priceId: pro, label: "Pro" }] : [];
};

export const FREE_PLAN = "free";
