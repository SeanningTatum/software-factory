import { Effect } from "effect";
import { CloudflareEnv, setting } from "#/app/env.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { type WorkerVersion, workerVersion } from "#/features/core/lib/version.ts";
import { requiredSettings } from "#/gen/env.ts";

/** The part of a D1 binding the check uses. */
interface Pingable {
  prepare(query: string): { first(): Promise<unknown> };
}

export interface Readiness {
  readonly ok: boolean;
  /** Required settings that are missing, or APP_URL when it isn't the origin being served. */
  readonly missing: ReadonlyArray<string>;
  /** "up" or "down" when the project has a D1 binding; absent when it has none. */
  readonly database?: "up" | "down";
  /** The Worker version that answered. The deploy checks it reached the version it uploaded. */
  readonly version?: WorkerVersion;
}

/**
 * Whether this deploy can serve users: every required setting is set, APP_URL is the origin the
 * request came to (Better Auth refuses any other), and D1 answers when there is one. It names
 * settings and the Worker version; no setting's value leaves the Worker.
 */
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
  return {
    ok: missing.length === 0 && database !== "down",
    missing,
    ...(database ? { database } : {}),
    ...(version ? { version } : {}),
  } satisfies Readiness;
});
