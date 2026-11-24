import { Effect, Schema } from "effect";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import { stepOrder } from "../machines/onboarding.machine.ts";

/** The user id becomes part of the Workflow instance id, which allows letters, digits, "-" and "_". */
export const OnboardingParams = Schema.Struct({
  userId: Schema.String.check(Schema.isMaxLength(64), Schema.isPattern(/^[\w-]+$/)),
});
export type OnboardingParams = typeof OnboardingParams.Type;

/** The two things a workflow step can do, so the steps can run against a fake in tests. */
export interface Steps {
  readonly run: (name: string, work: () => Promise<void>) => Promise<void>;
  readonly sleep: (
    name: string,
    duration: `${number} ${"second" | "minute" | "hour" | "day"}s`,
  ) => Promise<void>;
}

/** Runs one step's Effect; the workflow class supplies a runtime with the app's services. */
export type RunEffect = (effect: Effect.Effect<void, never, Analytics>) => Promise<void>;

const work: Record<string, (params: OnboardingParams) => Effect.Effect<void, never, Analytics>> = {
  welcome: (params) =>
    Effect.gen(function* () {
      yield* Effect.logInfo("onboarding: welcome", { userId: params.userId });
      yield* (yield* Analytics).capture({ _tag: "onboarding_started" }, params.userId);
    }),
  nudge: (params) => Effect.logInfo("onboarding: nudge", { userId: params.userId }),
};

const WAIT = "1 days" as const;

/** Runs the onboarding steps in the order the machine sets. */
export const runOnboarding = async (
  params: OnboardingParams,
  steps: Steps,
  runEffect: RunEffect,
) => {
  for (const name of stepOrder()) {
    const stepWork = work[name];
    if (stepWork) await steps.run(name, () => runEffect(stepWork(params)));
    else await steps.sleep(name, WAIT);
  }
  await steps.run("complete", () =>
    runEffect(
      Effect.gen(function* () {
        yield* (yield* Analytics).capture({ _tag: "onboarding_completed" }, params.userId);
      }),
    ),
  );
};
