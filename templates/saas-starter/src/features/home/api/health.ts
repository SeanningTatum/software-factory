import { Effect } from "effect";
import { CloudflareEnv, setting } from "#/app/env.ts";
import { selectAdapter } from "#/features/core/analytics/api/analytics.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { type WorkerVersion, workerVersion } from "#/features/core/lib/version.ts";
import { requiredSettings } from "#/gen/env.ts";

interface Pingable {
  prepare(query: string): { first(): Promise<unknown> };
}

export interface Readiness {
  readonly ok: boolean;
  readonly missing: ReadonlyArray<string>;
  readonly database?: "up" | "down";
  readonly version?: WorkerVersion;
  readonly warnings?: ReadonlyArray<string>;
}

const analyticsWarning = (env: Parameters<typeof selectAdapter>[0]) => {
  const provider = setting(env, "ANALYTICS_PROVIDER");
  return provider && provider !== "none" && selectAdapter(env).name === "none"
    ? [`ANALYTICS_PROVIDER is ${provider}, but its key or binding is missing: analytics is off`]
    : [];
};

export const readiness = Effect.fn("Health.readiness")(function* (requestUrl: string) {
  const env = yield* CloudflareEnv;
  const missing: Array<string> = requiredSettings.filter((key) => !setting(env, key));
  const appUrl = setting(env, "APP_URL");
  if (appUrl && URL.parse(appUrl)?.origin !== new URL(requestUrl).origin)
    missing.push("APP_URL (not this origin)");
  const db = binding<Pingable>(env, "DB");
  const database = db
    ? yield* outsideCall(
        "health.db",
        () => db.prepare("SELECT 1").first(),
        () => "down" as const,
      ).pipe(
        Effect.as("up" as const),
        Effect.catch((down) => Effect.succeed(down)),
      )
    : undefined;
  const version = workerVersion(env);
  const warnings = analyticsWarning(env);
  return {
    ok: missing.length === 0 && database !== "down",
    missing,
    ...(database ? { database } : {}),
    ...(version ? { version } : {}),
    ...(warnings.length ? { warnings } : {}),
  } satisfies Readiness;
});
