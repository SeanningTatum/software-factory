import { Context, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/core/env.ts";
import { NotConfigured } from "#/core/errors.ts";
import type { OnboardingParams } from "./onboarding.ts";

/** The part of a Workflow binding the service uses. */
export interface WorkflowBinding {
  create(options: { id?: string; params: OnboardingParams }): Promise<{ id: string }>;
  get(id: string): Promise<{ status(): Promise<{ status: string }> }>;
}

export class WorkflowError extends Schema.TaggedError<WorkflowError>()("WorkflowError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export class Onboarding extends Context.Service<
  Onboarding,
  {
    readonly start: (
      params: OnboardingParams,
    ) => Effect.Effect<{ id: string }, WorkflowError | NotConfigured>;
    readonly status: (
      id: string,
    ) => Effect.Effect<{ status: string }, WorkflowError | NotConfigured>;
  }
>()("app/blocks/workflows/Onboarding") {
  static readonly fromBinding = (binding: WorkflowBinding) => {
    const call = <A>(operation: string, run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: (cause) => new WorkflowError({ operation, cause }),
      }).pipe(Effect.withSpan(`workflow.onboarding.${operation}`, { kind: "client" }));
    return Onboarding.of({
      start: (params) => call("create", () => binding.create({ params })),
      status: (id) => call("status", async () => (await binding.get(id)).status()),
    });
  };

  static readonly layer = Layer.effect(
    Onboarding,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const binding = (env as unknown as { ONBOARDING_WORKFLOW?: WorkflowBinding })
        .ONBOARDING_WORKFLOW;
      if (binding) return Onboarding.fromBinding(binding);
      const missing = Effect.fail(
        new NotConfigured({ setting: "ONBOARDING_WORKFLOW (Workflow binding)" }),
      );
      return Onboarding.of({ start: () => missing, status: () => missing });
    }),
  );
}
