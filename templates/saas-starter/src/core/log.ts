import { Cause, Context, Layer, Logger, type LogLevel, References, Tracer } from "effect";
import { writeLine } from "./log-sink.ts";
import { redact } from "./redact.ts";
import type { RequestInfo } from "./request.ts";

type Sink = (level: string, line: Record<string, unknown>) => void;

const text = (message: unknown) => {
  const parts = Array.isArray(message) ? message : [message];
  return parts.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" ");
};

/** A JSON logger that stamps every line with the request id, the user and the current span. */
export const makeLogger = (info: RequestInfo, sink: Sink = writeLine) =>
  Logger.make<unknown, void>(({ message, logLevel, cause, fiber, date }) => {
    const span = Context.getOption(fiber.context, Tracer.ParentSpan);
    const annotations = fiber.getRef(References.CurrentLogAnnotations);
    const line = {
      time: date.toISOString(),
      level: logLevel,
      message: text(message),
      requestId: info.id,
      userId: info.userId,
      method: info.method,
      path: info.path,
      traceId: span._tag === "Some" ? span.value.traceId : info.trace?.traceId,
      spanId: span._tag === "Some" ? span.value.spanId : undefined,
      ...annotations,
      cause: cause.reasons.length ? Cause.pretty(cause) : undefined,
    };
    sink(logLevel, redact(line) as Record<string, unknown>);
  });

const LEVELS = ["Trace", "Debug", "Info", "Warn", "Error", "Fatal"] as const;
export type Level = (typeof LEVELS)[number];

export const parseLevel = (value: string | undefined): Level =>
  LEVELS.find((level) => level.toLowerCase() === value?.toLowerCase()) ?? "Info";

export const LoggerLayer = (info: RequestInfo, level: Level, sink?: Sink) =>
  Layer.mergeAll(
    Logger.layer([makeLogger(info, sink)]),
    Layer.succeed(References.MinimumLogLevel)(level satisfies LogLevel.LogLevel),
  );
