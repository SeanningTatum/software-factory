/** What the landing page and docs say about each optional feature. A test keeps it in step with each feature.json. */
export interface FeatureInfo {
  readonly name: string;
  readonly title: string;
  readonly requires: ReadonlyArray<string>;
  readonly summary: string;
  readonly brings: ReadonlyArray<string>;
}

/** The features every project has. They can't be removed. */
export const coreFeatures: ReadonlyArray<string> = [
  "observability",
  "analytics",
  "consent",
  "ui",
  "home",
];

export const features: ReadonlyArray<FeatureInfo> = [
  {
    name: "db",
    title: "Database",
    requires: [],
    summary: "Cloudflare D1 (SQLite) through Drizzle, behind an Effect Database service.",
    brings: [
      "A Database service with a span per query",
      "One migration sequence for every feature's tables",
      "Tests that run real SQL in memory",
    ],
  },
  {
    name: "auth",
    title: "Auth",
    requires: ["db"],
    summary: "Better Auth with email and password, and GitHub once you add keys.",
    brings: [
      "Sign-in and sign-up forms driven by a machine",
      "Rate limits on the password routes",
      "Sign-in events recorded on the server",
    ],
  },
  {
    name: "billing",
    title: "Billing",
    requires: ["auth"],
    summary: "Stripe subscriptions through Better Auth's Stripe plugin.",
    brings: [
      "Checkout and the customer portal",
      "Webhooks checked against a subscription machine",
      "Stays off until you set the keys",
    ],
  },
  {
    name: "kv",
    title: "KV",
    requires: [],
    summary: "Workers KV behind a typed KeyValue service.",
    brings: ["Values checked with a Schema on the way in and out", "A read-through cache helper"],
  },
  {
    name: "workflows",
    title: "Workflows",
    requires: [],
    summary: "A durable Cloudflare Workflow whose steps are Effects.",
    brings: [
      "Step order set by a machine and checked by a test",
      "An endpoint, guarded by a token, to start and read runs",
    ],
  },
  {
    name: "uploads",
    title: "Uploads",
    requires: ["auth"],
    summary: "Per-user file uploads to R2.",
    brings: [
      "Size, type and magic-byte checks",
      "A rate limit per user",
      "An upload machine that can retry",
    ],
  },
];

export const CREATE_COMMAND = "bunx create-tanstack-cf-saas my-app";
