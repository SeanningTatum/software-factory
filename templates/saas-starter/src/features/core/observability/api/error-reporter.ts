import { ErrorReporter } from "effect";
import { type AppEnv, setting } from "#/app/env.ts";
import type { RequestInfo } from "#/app/request.ts";
import { writeLine } from "../lib/log-sink.ts";
import { redact, redactText } from "../lib/redact.ts";

export interface Report {
  readonly error: Error;
  readonly severity: string;
  readonly request: RequestInfo;
}

type Send = (report: Report) => void;

const DSN = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/;

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

const ALERT_QUIET_MS = 5 * 60 * 1000;
const ALERT_MAX_CHARS = 1500;

/**
 * `text` for Slack, `content` for Discord. Capped under Discord's 2000 characters, with mentions
 * off, since the path comes from the caller.
 */
export const alertRequest = (url: string, { error, request }: Report) => {
  const text =
    `Error on ${request.method} ${redactText(request.path)} (request ${request.id}): ${redactText(error.message)}`.slice(
      0,
      ALERT_MAX_CHARS,
    );
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, content: text, allowed_mentions: { parse: [] } }),
  });
};

/**
 * Posts the first error of a burst to the alert webhook, then stays quiet for five minutes.
 * shortcut: the quiet window lives in one Worker isolate, so a burst spread over many isolates can
 * send a few alerts; move the window to a Durable Object if that gets noisy.
 */
export const makeAlerter = (now: () => number = Date.now) => {
  let quietUntil = 0;
  // A failed post reopens the window, so the next error tries again.
  const failed = (report: Report, message: string) => {
    quietUntil = 0;
    toConsole({ ...report, error: new Error(message) });
  };
  return (url: string, report: Report, waitUntil: (p: Promise<unknown>) => void) => {
    // Anyone can post a browser report, so one must never alert or silence real errors.
    if (report.error.name === "BrowserError" || now() < quietUntil) return;
    quietUntil = now() + ALERT_QUIET_MS;
    waitUntil(
      fetch(alertRequest(url, report)).then(
        (res) => (res.ok ? undefined : failed(report, `Alert webhook refused: ${res.status}`)),
        () => failed(report, "Alert webhook unreachable"),
      ),
    );
  };
};
const alert = makeAlerter();

/** A missing or bad setting falls back to the console. */
const reportTo = (env: AppEnv, waitUntil: (p: Promise<unknown>) => void): Send => {
  const kind = setting(env, "ERROR_REPORTER") ?? "console";
  const dsn = setting(env, "SENTRY_DSN");
  if (kind === "none") return () => undefined;
  if (kind === "sentry" && dsn) return toSentry(dsn, waitUntil);
  return toConsole;
};

export const selectSender = (
  env: AppEnv,
  waitUntil: (p: Promise<unknown>) => void,
  alerter = alert,
): Send => {
  const send = reportTo(env, waitUntil);
  const webhook = setting(env, "ALERT_WEBHOOK_URL");
  if (!webhook || !URL.canParse(webhook)) return send;
  return (report) => {
    send(report);
    alerter(webhook, report, waitUntil);
  };
};

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
