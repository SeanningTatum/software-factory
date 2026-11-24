import { ErrorReporter } from "effect";
import { type AppEnv, setting } from "./env.ts";
import { writeLine } from "./log-sink.ts";
import { redact, redactText } from "./redact.ts";
import type { RequestInfo } from "./request.ts";

export interface Report {
  readonly error: Error;
  readonly severity: string;
  readonly request: RequestInfo;
}

type Send = (report: Report) => void;

const DSN = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/;

/** Builds a Sentry envelope request from a DSN; undefined when the DSN is malformed. */
export const sentryRequest = (
  dsn: string,
  report: Report,
  now = new Date(),
): Request | undefined => {
  const match = DSN.exec(dsn);
  if (!match) return undefined;
  const [, key, host, project] = match as unknown as [string, string, string, string];
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "javascript",
    level: report.severity.toLowerCase() === "fatal" ? "fatal" : "error",
    exception: {
      values: [
        { type: report.error.name, value: redactText(report.error.message), stacktrace: undefined },
      ],
    },
    tags: {
      requestId: report.request.id,
      method: report.request.method,
      path: report.request.path,
    },
    user: report.request.userId ? { id: report.request.userId } : undefined,
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  return new Request(`https://${host}/api/${project}/envelope/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=tanstack-cf-saas/1`,
    },
    body,
  });
};

const toConsole: Send = ({ error, severity, request }) =>
  writeLine(
    "Error",
    redact({
      level: "Error",
      message: "error reported",
      severity,
      requestId: request.id,
      userId: request.userId,
      error,
    }) as Record<string, unknown>,
  );

const toSentry =
  (dsn: string, waitUntil: (p: Promise<unknown>) => void): Send =>
  (report) => {
    const request = sentryRequest(dsn, report);
    if (!request) {
      toConsole(report);
      return;
    }
    waitUntil(
      fetch(request).then(
        (res) =>
          res.ok
            ? undefined
            : toConsole({
                ...report,
                error: new Error(`Sentry refused the report: ${res.status}`),
              }),
        () => toConsole(report),
      ),
    );
  };

/** Picks where errors go from ERROR_REPORTER. A missing or bad setting falls back to the console. */
export const selectSender = (env: AppEnv, waitUntil: (p: Promise<unknown>) => void): Send => {
  const kind = setting(env, "ERROR_REPORTER") ?? "console";
  const dsn = setting(env, "SENTRY_DSN");
  if (kind === "none") return () => undefined;
  if (kind === "sentry" && dsn) return toSentry(dsn, waitUntil);
  return toConsole;
};

/** Installs Effect's ErrorReporter so `ErrorReporter.report` sends failures where ERROR_REPORTER says. */
export const ErrorReporterLayer = (
  env: AppEnv,
  request: RequestInfo,
  waitUntil: (p: Promise<unknown>) => void,
) => {
  const send = selectSender(env, waitUntil);
  return ErrorReporter.layer([
    ErrorReporter.make(({ error, severity }) => send({ error, severity, request })),
  ]);
};
