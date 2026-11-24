import { Layer, ManagedRuntime } from "effect";
import { ErrorReporterLayer } from "#/features/observability/api/error-reporter.ts";
import { LoggerLayer, parseLevel } from "#/features/observability/api/log.ts";
import { FeaturesLayer } from "#/gen/layers.ts";
import { type AppEnv, CloudflareEnv, setting, WaitUntil } from "./env.ts";
import { CurrentRequest, type RequestInfo } from "./request.ts";

export interface RuntimeInput {
  readonly env: AppEnv;
  readonly request: RequestInfo;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * What every request has before any feature: the Worker's env, the request, `waitUntil`, and the
 * logger and error reporter from the observability feature. Those two are installed here, not
 * through src/gen/layers.ts, because they need the env and the request before any layer is built.
 */
export const kernelLayer = ({ env, request, waitUntil }: RuntimeInput) => {
  const base = Layer.mergeAll(
    CloudflareEnv.layer(env),
    CurrentRequest.layer(request),
    WaitUntil.layer(waitUntil),
  );
  return ErrorReporterLayer(env, request, waitUntil).pipe(
    Layer.provideMerge(base),
    Layer.provideMerge(LoggerLayer(request, parseLevel(setting(env, "LOG_LEVEL")))),
  );
};

/** The kernel plus every enabled feature's services, built fresh for one request. */
export const appLayer = (input: RuntimeInput) =>
  FeaturesLayer.pipe(Layer.provideMerge(kernelLayer(input)));

export type AppLayer = ReturnType<typeof appLayer>;
export type AppServices = AppLayer extends Layer.Layer<infer A, infer _E, infer _R> ? A : never;
export type AppLayerError = AppLayer extends Layer.Layer<infer _A, infer E, infer _R> ? E : never;
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, AppLayerError>;

/** One runtime per request; the request middleware disposes it, which flushes analytics. */
export const makeRuntime = (input: RuntimeInput): AppRuntime =>
  ManagedRuntime.make(appLayer(input));
