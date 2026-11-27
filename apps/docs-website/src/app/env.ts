import { Context, Layer } from "effect";
import type { FeatureSecrets } from "#/gen/env.ts";

export type AppEnv = Env & FeatureSecrets;

export class CloudflareEnv extends Context.Service<CloudflareEnv, AppEnv>()("app/CloudflareEnv") {
  static readonly layer = (env: AppEnv) => Layer.succeed(CloudflareEnv)(env);
}

export class WaitUntil extends Context.Service<WaitUntil, (promise: Promise<unknown>) => void>()(
  "app/WaitUntil",
) {
  static readonly layer = (waitUntil: (promise: Promise<unknown>) => void) =>
    Layer.succeed(WaitUntil)(waitUntil);
}

export const setting = (env: AppEnv, key: string): string | undefined => {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};
