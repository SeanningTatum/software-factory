import { Schema } from "effect";

const Method = Schema.Literals(["email", "github"]);

const SignUpCompleted = Schema.TaggedStruct("sign_up_completed", { method: Method });
const SignInSucceeded = Schema.TaggedStruct("sign_in_succeeded", { method: Method });
const SignInFailed = Schema.TaggedStruct("sign_in_failed", {
  reason: Schema.Literals(["invalid_credentials", "rate_limited", "other"]),
});
const SignedOut = Schema.TaggedStruct("signed_out", {});

export const events = [SignUpCompleted, SignInSucceeded, SignInFailed, SignedOut] as const;
