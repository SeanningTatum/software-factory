import { Schema } from "effect";

const OnboardingStarted = Schema.TaggedStruct("onboarding_started", {});
const OnboardingCompleted = Schema.TaggedStruct("onboarding_completed", {});

export const events = [OnboardingStarted, OnboardingCompleted] as const;

/** What success looks like for this feature, and the catalog events that measure it. */
export const metric = {
  name: "Share of started onboardings that finish",
  events: ["onboarding_started", "onboarding_completed"],
} as const;
