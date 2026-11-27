import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class WorkflowError extends Schema.TaggedError<WorkflowError>()("WorkflowError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export type Errors = WorkflowError;

export const errorStatus = {
  WorkflowError: { status: 502, message: "Couldn't reach the workflow engine. Try again." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
