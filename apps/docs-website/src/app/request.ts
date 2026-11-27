// cf-saas-lint allow comments
import { Context, Effect, Layer, Tracer } from "effect";

export interface RequestInfo {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly trace: Traceparent | undefined;
  /** Never logged: they carry cookies. */
  readonly headers: Headers;
  userId: string | undefined;
}

export interface Traceparent {
  readonly traceId: string;
  readonly spanId: string;
  readonly sampled: boolean;
}

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO = /^0+$/;
const CF_RAY = /^[0-9a-f]{16}(-[A-Z]{3})?$/;
const SAMPLED = 1;

export const parseTraceparent = (header: string | null): Traceparent | undefined => {
  const match = header ? TRACEPARENT.exec(header.trim().toLowerCase()) : null;
  if (!match) return undefined;
  const [, version, traceId, spanId, flags] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (version === "ff" || ZERO.test(traceId) || ZERO.test(spanId)) return undefined;
  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & SAMPLED) === SAMPLED };
};

const randomId = () => crypto.randomUUID().replaceAll("-", "");

export const requestIdFrom = (
  headers: Headers,
  trace = parseTraceparent(headers.get("traceparent")),
) => {
  if (trace) return trace.traceId;
  const ray = headers.get("cf-ray");
  return ray && CF_RAY.test(ray) ? ray : randomId();
};

export const requestInfoFrom = (request: Request): RequestInfo => {
  const trace = parseTraceparent(request.headers.get("traceparent"));
  const url = new URL(request.url);
  return {
    id: requestIdFrom(request.headers, trace),
    method: request.method,
    path: url.pathname,
    trace,
    headers: request.headers,
    userId: undefined,
  };
};

const HEX32 = /^[0-9a-f]{32}$/;
const SPAN_ID_LENGTH = 16;

export const parentSpanFor = (info: RequestInfo) =>
  Tracer.externalSpan(
    info.trace ?? {
      traceId: HEX32.test(info.id) ? info.id : randomId(),
      spanId: randomId().slice(0, SPAN_ID_LENGTH),
      sampled: true,
    },
  );

export class CurrentRequest extends Context.Service<
  CurrentRequest,
  {
    readonly info: RequestInfo;
    readonly setUser: (userId: string | undefined) => Effect.Effect<void>;
  }
>()("app/CurrentRequest") {
  static readonly layer = (info: RequestInfo) =>
    Layer.succeed(CurrentRequest)({
      info,
      setUser: (userId) =>
        Effect.sync(() => {
          info.userId = userId;
        }),
    });
}
