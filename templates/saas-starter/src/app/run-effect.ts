import { setResponseStatus } from "@tanstack/react-start/server";
import { Cause, Effect, ErrorReporter, Exit, Option } from "effect";
import { type AppError, type ErrorInfo, errorInfo, INTERNAL, RateLimited } from "./errors.ts";
import { parentSpanFor, type RequestInfo } from "./request.ts";
import type { AppRuntime, AppServices } from "./runtime.ts";

export interface EdgeContext {
  readonly runtime: AppRuntime;
  readonly request: RequestInfo;
}

export interface FailureBody {
  readonly error: string;
  readonly message: string;
  readonly requestId: string;
}

export class PublicError extends Error {
  constructor(
    readonly status: number,
    readonly body: FailureBody,
  ) {
    super(body.message);
    this.name = "PublicError";
  }
}

export const describeFailure = (
  cause: Cause.Cause<unknown>,
  requestId: string,
): { info: ErrorInfo; body: FailureBody } => {
  const failure = Cause.findErrorOption(cause);
  const tag =
    Option.isSome(failure) &&
    typeof failure.value === "object" &&
    failure.value !== null &&
    "_tag" in failure.value
      ? String(failure.value._tag)
      : "Internal";
  const info = tag === "Internal" ? INTERNAL : errorInfo(tag);
  return { info, body: { error: tag, message: info.message, requestId } };
};

const SERVER_ERROR = 500;

export const runExit = <A, E extends AppError>(
  context: EdgeContext,
  effect: Effect.Effect<A, E, AppServices>,
  span: string,
) =>
  context.runtime.runPromiseExit(
    effect.pipe(
      Effect.tapCause((cause) => {
        const { info, body } = describeFailure(cause, context.request.id);
        if (info.status < SERVER_ERROR)
          return Effect.logInfo("request failed").pipe(
            Effect.annotateLogs({ status: info.status, error: body.error }),
          );
        return Effect.logError("request failed", cause).pipe(
          Effect.andThen(ErrorReporter.report(cause)),
        );
      }),
      Effect.withSpan(span),
      Effect.withParentSpan(parentSpanFor(context.request)),
    ),
  );

export const runEffect = async <A, E extends AppError>(
  context: EdgeContext,
  effect: Effect.Effect<A, E, AppServices>,
  span = "serverFn",
): Promise<A> => {
  const exit = await runExit(context, effect, span);
  if (Exit.isSuccess(exit)) return exit.value;
  const { info, body } = describeFailure(exit.cause, context.request.id);
  setResponseStatus(info.status);
  throw new PublicError(info.status, body);
};

export const runResponse = async <E extends AppError>(
  context: EdgeContext,
  effect: Effect.Effect<Response, E, AppServices>,
  span = "route",
): Promise<Response> => {
  const exit = await runExit(context, effect, span);
  if (Exit.isSuccess(exit)) return exit.value;
  const { info, body } = describeFailure(exit.cause, context.request.id);
  const failure = Cause.findErrorOption(exit.cause);
  const headers =
    Option.isSome(failure) && failure.value instanceof RateLimited
      ? { "retry-after": String(failure.value.retryAfterSeconds) }
      : undefined;
  return Response.json(body, { status: info.status, headers });
};
