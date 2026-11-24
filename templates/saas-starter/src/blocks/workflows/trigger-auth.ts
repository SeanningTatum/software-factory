import { Effect } from "effect";
import { CloudflareEnv, setting } from "#/core/env.ts";
import { NotConfigured, Unauthorized } from "#/core/errors.ts";

/** Compares two strings in time that depends only on their length. */
export const safeEqual = (a: string, b: string) => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
};

/** Only callers holding WORKFLOWS_TRIGGER_TOKEN may start or read workflows over HTTP. */
export const requireTriggerToken = (headers: Headers) =>
  Effect.gen(function* () {
    const expected = setting(yield* CloudflareEnv, "WORKFLOWS_TRIGGER_TOKEN");
    if (!expected) return yield* new NotConfigured({ setting: "WORKFLOWS_TRIGGER_TOKEN" });
    const given = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!safeEqual(given, expected)) return yield* new Unauthorized();
  });
