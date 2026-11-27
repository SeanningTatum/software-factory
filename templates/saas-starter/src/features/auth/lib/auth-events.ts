import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import {
  CODE_SIGN_IN,
  RESET_PASSWORD,
  SIGN_IN,
  SIGN_OUT,
  SIGN_UP,
  VERIFY_EMAIL,
} from "../constants.ts";

export interface Captured {
  readonly event: AnalyticsEvent;
  readonly distinctId?: string;
}

const TOO_MANY = 429;
const CREDENTIAL_FAILURES = new Set([401, 403]);

const isOk = (status: number) => status >= 200 && status < 400;

const NO_CAPTCHA = "MISSING_RESPONSE";

const failureReason = (status: number, code: string | undefined) => {
  if (status === TOO_MANY) return "rate_limited" as const;
  if (code === NO_CAPTCHA) return "challenged" as const;
  return CREDENTIAL_FAILURES.has(status) ? ("invalid_credentials" as const) : ("other" as const);
};

type Rule = (
  status: number,
  userId: string | undefined,
  code: string | undefined,
) => ReadonlyArray<Captured>;

const rules: ReadonlyArray<{ method: string; path: string; rule: Rule }> = [
  {
    method: "POST",
    path: SIGN_UP,
    rule: (status, userId) =>
      isOk(status)
        ? [{ event: { _tag: "sign_up_completed", method: "email" }, distinctId: userId }]
        : [],
  },
  {
    method: "POST",
    path: SIGN_IN,
    rule: (status, userId, code) =>
      isOk(status)
        ? [{ event: { _tag: "sign_in_succeeded", method: "email" }, distinctId: userId }]
        : [{ event: { _tag: "sign_in_failed", reason: failureReason(status, code) } }],
  },
  {
    method: "POST",
    path: CODE_SIGN_IN,
    rule: (status, userId, code) =>
      isOk(status)
        ? [{ event: { _tag: "sign_in_succeeded", method: "code" }, distinctId: userId }]
        : [{ event: { _tag: "sign_in_failed", reason: failureReason(status, code) } }],
  },
  {
    method: "POST",
    path: VERIFY_EMAIL,
    rule: (status, userId) =>
      isOk(status) ? [{ event: { _tag: "email_verified" }, distinctId: userId }] : [],
  },
  {
    method: "POST",
    path: RESET_PASSWORD,
    rule: (status) => (isOk(status) ? [{ event: { _tag: "password_reset" } }] : []),
  },
  {
    method: "POST",
    path: SIGN_OUT,
    rule: (status) => (isOk(status) ? [{ event: { _tag: "signed_out" } }] : []),
  },
];

export const authEvents = (
  method: string,
  path: string,
  status: number,
  body: unknown,
): ReadonlyArray<Captured> => {
  const match = rules.find((r) => r.method === method && r.path === path);
  const parsed = body as { user?: { id?: string }; code?: unknown } | null;
  const code = typeof parsed?.code === "string" ? parsed.code : undefined;
  return match ? match.rule(status, parsed?.user?.id, code) : [];
};
