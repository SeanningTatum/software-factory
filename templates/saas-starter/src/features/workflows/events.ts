import { Schema } from "effect";

const OnboardingStarted = Schema.TaggedStruct("onboarding_started", {});
const OnboardingCompleted = Schema.TaggedStruct("onboarding_completed", {});

export const events = [OnboardingStarted, OnboardingCompleted] as const;

export const metric = {
  name: "Share of started onboardings that finish",
  events: ["onboarding_started", "onboarding_completed"],
} as const;
