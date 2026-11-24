import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { Onboarding } from "./onboarding-service.ts";

describe("Onboarding", () => {
  it("starts a run and reads its status through the binding", async () => {
    const created: Array<unknown> = [];
    const onboarding = Onboarding.fromBinding({
      create: async (options) => {
        created.push(options);
        return { id: "run_1" };
      },
      get: async () => ({ status: async () => ({ status: "running" }) }),
    });
    expect(await Effect.runPromise(onboarding.start({ userId: "u1" }))).toEqual({ id: "run_1" });
    expect(created).toEqual([{ id: "onboarding-u1", params: { userId: "u1" } }]);
    expect(await Effect.runPromise(onboarding.status("run_1"))).toEqual({ status: "running" });
  });

  it("wraps binding failures in WorkflowError", async () => {
    const onboarding = Onboarding.fromBinding({
      create: () => Promise.reject(new Error("quota")),
      get: () => Promise.reject(new Error("quota")),
    });
    const exit = await Effect.runPromiseExit(onboarding.start({ userId: "u1" }));
    expect(JSON.stringify(exit)).toContain("WorkflowError");
  });

  it("starts one run per user: a retried start returns the run already there", async () => {
    const runs = new Set<string>();
    const onboarding = Onboarding.fromBinding({
      create: async ({ id = "" }) => {
        if (runs.has(id)) return Promise.reject(new Error("instance already exists"));
        runs.add(id);
        return { id };
      },
      get: async (id) =>
        runs.has(id)
          ? { status: async () => ({ status: "running" }) }
          : Promise.reject(new Error("not found")),
    });
    const first = await Effect.runPromise(onboarding.start({ userId: "u1" }));
    const second = await Effect.runPromise(onboarding.start({ userId: "u1" }));
    expect(second).toEqual(first);
    expect(runs.size).toBe(1);
  });
});
