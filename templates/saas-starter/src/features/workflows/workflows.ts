import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Schema } from "effect";
import type { AppEnv } from "#/app/env.ts";
import { requestInfoFrom } from "#/app/request.ts";
import { makeRuntime } from "#/app/runtime.ts";
import { OnboardingParams, runOnboarding } from "./api/onboarding.ts";

export class OnboardingWorkflow extends WorkflowEntrypoint<AppEnv, OnboardingParams> {
  override async run(event: Readonly<WorkflowEvent<OnboardingParams>>, step: WorkflowStep) {
    const params = Schema.decodeUnknownSync(OnboardingParams)(event.payload);
    const request = {
      ...requestInfoFrom(new Request(`https://workflow.internal/onboarding/${event.instanceId}`)),
      id: event.instanceId,
      userId: params.userId,
    };
    await runOnboarding(
      params,
      {
        run: (name, work) => step.do(name, work),
        sleep: (name, duration) => step.sleep(name, duration),
      },
      async (effect) => {
        const runtime = makeRuntime({
          env: this.env,
          request,
          waitUntil: (p) => this.ctx.waitUntil(p),
        });
        await runtime.runPromise(effect).finally(() => runtime.dispose());
      },
    );
  }
}
