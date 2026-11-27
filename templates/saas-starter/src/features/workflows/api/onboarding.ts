import { Effect, Schema } from "effect";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import { stepOrder } from "../machines/onboarding.machine.ts";

export const OnboardingParams = Schema.Struct({
  userId: Schema.String.check(Schema.isMaxLength(64), Schema.isPattern(/^[\w-]+$/)),
});
export type OnboardingParams = typeof OnboardingParams.Type;

export interface Steps {
  readonly run: (name: string, work: () => Promise<void>) => Promise<void>;
  readonly sleep: (
    name: string,
    duration: `${number} ${"second" | "minute" | "hour" | "day"}s`,
  ) => Promise<void>;
}

export type RunEffect = (effect: Effect.Effect<void, never, Analytics>) => Promise<void>;

const work: Record<string, (params: OnboardingParams) => Effect.Effect<void, never, Analytics>> = {
  welcome: (params) =>
    Effect.gen(function* () {
      yield* Effect.logInfo("onboarding: welcome", { userId: params.userId });
      const analytics = yield* Analytics;
      yield* analytics.capture({ _tag: "onboarding_started" }, params.userId);
    }),
  nudge: (params) => Effect.logInfo("onboarding: nudge", { userId: params.userId }),
};

const WAIT = "1 days" as const;

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
        const analytics = yield* Analytics;
        yield* analytics.capture({ _tag: "onboarding_completed" }, params.userId);
      }),
    ),
  );
};
