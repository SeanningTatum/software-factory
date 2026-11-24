import { Context, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
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
>()("app/features/workflows/Onboarding") {
  static readonly fromBinding = (binding: WorkflowBinding) => {
    const call = <A>(operation: string, run: () => Promise<A>) =>
      outsideCall(
        `workflow.onboarding.${operation}`,
        run,
        (cause) => new WorkflowError({ operation, cause }),
      );
    return Onboarding.of({
      start: (params) => call("create", () => binding.create({ params })),
      status: (id) => call("status", async () => (await binding.get(id)).status()),
    });
  };

  static readonly layer = Layer.effect(
    Onboarding,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const workflow = binding<WorkflowBinding>(env, "ONBOARDING_WORKFLOW");
      if (workflow) return Onboarding.fromBinding(workflow);
      const missing = Effect.fail(
        new NotConfigured({ setting: "ONBOARDING_WORKFLOW (Workflow binding)" }),
      );
      return Onboarding.of({ start: () => missing, status: () => missing });
    }),
  );
}
