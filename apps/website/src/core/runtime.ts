import { Layer, ManagedRuntime } from "effect";
import { BlocksLayer } from "#/gen/layers.ts";
import { Analytics } from "./analytics/analytics.ts";
import { type AppEnv, CloudflareEnv, setting, WaitUntil } from "./env.ts";
import { ErrorReporterLayer } from "./error-reporter.ts";
import { LoggerLayer, parseLevel } from "./log.ts";
import { CurrentRequest, type RequestInfo } from "./request.ts";

export interface RuntimeInput {
  readonly env: AppEnv;
  readonly request: RequestInfo;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/** Services every request has, whatever blocks are enabled. */
export const coreLayer = ({ env, request, waitUntil }: RuntimeInput) => {
  const base = Layer.mergeAll(
    CloudflareEnv.layer(env),
    CurrentRequest.layer(request),
    WaitUntil.layer(waitUntil),
  );
  return Layer.mergeAll(Analytics.layer, ErrorReporterLayer(env, request, waitUntil)).pipe(
    Layer.provideMerge(base),
    Layer.provideMerge(LoggerLayer(request, parseLevel(setting(env, "LOG_LEVEL")))),
  );
};

/** Core plus every enabled block, built fresh for one request. */
export const appLayer = (input: RuntimeInput) =>
  BlocksLayer.pipe(Layer.provideMerge(coreLayer(input)));

export type AppLayer = ReturnType<typeof appLayer>;
export type AppServices = AppLayer extends Layer.Layer<infer A, infer _E, infer _R> ? A : never;
export type AppLayerError = AppLayer extends Layer.Layer<infer _A, infer E, infer _R> ? E : never;
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, AppLayerError>;

/** One runtime per request; the request middleware disposes it, which flushes analytics. */
export const makeRuntime = (input: RuntimeInput): AppRuntime =>
  ManagedRuntime.make(appLayer(input));
