import type { ErrorInfo } from "#/app/errors.ts";
import type { WorkflowError } from "./api/onboarding-service.ts";

export type Errors = WorkflowError;

export const errorStatus = {
  WorkflowError: { status: 502, message: "Couldn't reach the workflow engine. Try again." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
