import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";

export interface Captured {
  readonly event: AnalyticsEvent;
  readonly distinctId?: string;
}

const TOO_MANY = 429;
const CREDENTIAL_FAILURES = new Set([401, 403]);

const isOk = (status: number) => status >= 200 && status < 400;

const failureReason = (status: number) => {
  if (status === TOO_MANY) return "rate_limited" as const;
  return CREDENTIAL_FAILURES.has(status) ? ("invalid_credentials" as const) : ("other" as const);
};

type Rule = (
  status: number,
  userId: string | undefined,
  signedIn: boolean,
) => ReadonlyArray<Captured>;

const rules: ReadonlyArray<{ method: string; path: string; prefix?: boolean; rule: Rule }> = [
  {
    method: "POST",
    path: "/api/auth/sign-up/email",
    rule: (status, userId) =>
      isOk(status)
        ? [{ event: { _tag: "sign_up_completed", method: "email" }, distinctId: userId }]
        : [],
  },
  {
    method: "POST",
    path: "/api/auth/sign-in/email",
    rule: (status, userId) =>
      isOk(status)
        ? [{ event: { _tag: "sign_in_succeeded", method: "email" }, distinctId: userId }]
        : [{ event: { _tag: "sign_in_failed", reason: failureReason(status) } }],
  },
  {
    method: "GET",
    path: "/api/auth/callback/github",
    prefix: true,
    // Better Auth answers every OAuth failure with a redirect too; only a new session is a sign-in.
    rule: (_status, _userId, signedIn) =>
      signedIn ? [{ event: { _tag: "sign_in_succeeded", method: "github" } }] : [],
  },
  {
    method: "POST",
    path: "/api/auth/sign-out",
    rule: (status) => (isOk(status) ? [{ event: { _tag: "signed_out" } }] : []),
  },
];

const SESSION_COOKIE = /^(__Secure-)?[\w.-]*session_token=([^;]+)/;

/** Whether a response starts a session: it sets a non-empty session cookie that isn't expiring. */
export const setsSession = (headers: Headers) =>
  headers
    .getSetCookie()
    .some((cookie) => SESSION_COOKIE.test(cookie) && !/max-age=0\b/i.test(cookie));

/**
 * The analytics events an auth API response proves happened. Read on the server, where Better
 * Auth's answer is certain, not in the form. `body` is the parsed JSON response, if any.
 */
export const authEvents = (
  method: string,
  path: string,
  status: number,
  body: unknown,
  signedIn = false,
): ReadonlyArray<Captured> => {
  const match = rules.find(
    (r) => r.method === method && (r.prefix ? path.startsWith(r.path) : path === r.path),
  );
  const userId = (body as { user?: { id?: string } } | null)?.user?.id;
  return match ? match.rule(status, userId, signedIn) : [];
};
