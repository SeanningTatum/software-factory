import { setResponseStatus } from "@tanstack/react-start/server";
import { Cause, Effect, ErrorReporter, Exit, Option } from "effect";
import { type AppError, type ErrorInfo, errorInfo, INTERNAL, RateLimited } from "./errors.ts";
import { parentSpanFor, type RequestInfo } from "./request.ts";
import type { AppRuntime, AppServices } from "./runtime.ts";

/** What request middleware puts on every server function's and server route's context. */
export interface EdgeContext {
  readonly runtime: AppRuntime;
  readonly request: RequestInfo;
}

export interface FailureBody {
  readonly error: string;
  readonly message: string;
  readonly requestId: string;
}

/** The error a server function throws to the browser: a safe message, a status and the request id. */
export class PublicError extends Error {
  constructor(
    readonly status: number,
    readonly body: FailureBody,
  ) {
    super(body.message);
    this.name = "PublicError";
  }
}

/** Turns a failed Exit into a status and a body that is safe to send. Defects become a plain 500. */
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

/** Runs an effect on the request's runtime. Logs and reports anything that ends in a 5xx. */
export const runExit = <A, E extends AppError>(
  context: EdgeContext,
  effect: Effect.Effect<A, E, AppServices>,
  span: string,
) =>
  context.runtime.runPromiseExit(
    effect.pipe(
      Effect.tapCause((cause) => {
        const { info } = describeFailure(cause, context.request.id);
        if (info.status < SERVER_ERROR)
          return Effect.logInfo("request failed", { status: info.status });
        return Effect.logError("request failed", cause).pipe(
          Effect.andThen(ErrorReporter.report(cause)),
        );
      }),
      Effect.withSpan(span),
      Effect.withParentSpan(parentSpanFor(context.request)),
    ),
  );

/** The edge for server functions: returns the value, or sets the status and throws a PublicError. */
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

/** The edge for server routes: a Response either way. */
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
