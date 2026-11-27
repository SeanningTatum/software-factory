/** Emails become a short stable hash, so the same user can still be followed across lines. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const SECRET_PAIR =
  /\b(password|passwd|secret|token|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi;
const URL_USERINFO = /(\w+:\/\/)[^/\s:@]+:[^/\s@]+@/g;
const STRIPE_KEY = /\b(sk|rk|whsec)_(live|test)?_?[A-Za-z0-9]{8,}/g;

const SENSITIVE_KEYS =
  /^(password|passwd|secret|token|api[_-]?key|authorization|cookie|set-cookie|session|dsn)$/i;
const MAX_DEPTH = 6;
const HASH_HEX = 16;

/** A small non-cryptographic hash (FNV-1a, 64 bits) so redaction stays synchronous. */
const fnv1a = (text: string) => {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(HASH_HEX, "0");
};

export const redactText = (text: string): string =>
  text
    .replace(URL_USERINFO, "$1[redacted]@")
    .replace(BEARER, "$1 [redacted]")
    .replace(JWT, "[redacted-jwt]")
    .replace(STRIPE_KEY, "[redacted-key]")
    .replace(SECRET_PAIR, "$1$2[redacted]")
    .replace(EMAIL, (email) => `email:${fnv1a(email.toLowerCase())}`);

export const redact = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return redactText(value);
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[redacted]" : redact(item, depth + 1),
    ]),
  );
};
