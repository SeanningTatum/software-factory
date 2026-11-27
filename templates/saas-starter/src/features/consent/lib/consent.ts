import type { ConsentChoice } from "../components/consent.machine.ts";

export const CONSENT_COOKIE = "consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const readConsent = (cookieHeader: string | null | undefined): ConsentChoice | undefined => {
  const match = cookieHeader?.split(/;\s*/).find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  const value = match?.slice(CONSENT_COOKIE.length + 1);
  return value === "granted" || value === "denied" ? value : undefined;
};

export const optedOutFrom = (headers: Headers) =>
  headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";

export const consentCookie = (choice: ConsentChoice) =>
  `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`;
