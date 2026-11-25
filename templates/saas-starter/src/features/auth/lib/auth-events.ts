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

type Rule = (status: number, userId: string | undefined) => ReadonlyArray<Captured>;

const rules: ReadonlyArray<{ method: string; path: string; rule: Rule }> = [
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
    method: "POST",
    path: "/api/auth/sign-out",
    rule: (status) => (isOk(status) ? [{ event: { _tag: "signed_out" } }] : []),
  },
];

/**
 * The analytics events an auth API response proves happened. Read on the server, where Better
 * Auth's answer is certain, not in the form. `body` is the parsed JSON response, if any.
 */
export const authEvents = (
  method: string,
  path: string,
  status: number,
  body: unknown,
): ReadonlyArray<Captured> => {
  const match = rules.find((r) => r.method === method && r.path === path);
  const userId = (body as { user?: { id?: string } } | null)?.user?.id;
  return match ? match.rule(status, userId) : [];
};
