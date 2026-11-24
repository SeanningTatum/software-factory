import { Schema } from "effect";

const OnboardingStarted = Schema.TaggedStruct("onboarding_started", {});
const OnboardingCompleted = Schema.TaggedStruct("onboarding_completed", {});

export const events = [OnboardingStarted, OnboardingCompleted] as const;
