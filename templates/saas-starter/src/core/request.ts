import { Context, Effect, Layer, Tracer } from "effect";

/** What every log line, span and error report knows about the request it came from. */
export interface RequestInfo {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly trace: Traceparent | undefined;
  /** The incoming headers, for services that read cookies or the client's address. Never logged. */
  readonly headers: Headers;
  /** Filled in once a session is resolved. */
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

/** Parses a W3C traceparent header; rejects version ff and all-zero ids. */
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

/** The request id: the incoming trace id, else Cloudflare's ray id, else a random one. */
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

/**
 * The span every request's work hangs under: the caller's span when a traceparent came in,
 * otherwise a new root whose trace id is the request id, so logs and traces share one id.
 */
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
>()("app/core/CurrentRequest") {
  static readonly layer = (info: RequestInfo) =>
    Layer.succeed(CurrentRequest)({
      info,
      setUser: (userId) =>
        Effect.sync(() => {
          info.userId = userId;
        }),
    });
}
