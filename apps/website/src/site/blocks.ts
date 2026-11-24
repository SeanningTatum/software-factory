/** What the landing page and docs say about each block. Kept in step with each block.json. */
export interface BlockInfo {
  readonly name: string;
  readonly title: string;
  readonly requires: ReadonlyArray<string>;
  readonly summary: string;
  readonly brings: ReadonlyArray<string>;
}

export const blocks: ReadonlyArray<BlockInfo> = [
  {
    name: "d1",
    title: "D1 database",
    requires: [],
    summary: "SQLite at the edge through Drizzle, behind an Effect Database service.",
    brings: [
      "Database service with a span per query",
      "One migration sequence across blocks",
      "Real-SQL tests in memory",
    ],
  },
  {
    name: "auth",
    title: "Auth",
    requires: ["d1"],
    summary: "Better Auth with email and password, and GitHub once you add keys.",
    brings: [
      "Sign-in and sign-up forms driven by a machine",
      "Rate limits on password routes",
      "Sign-in events recorded on the server",
    ],
  },
  {
    name: "billing",
    title: "Billing",
    requires: ["auth"],
    summary: "Stripe subscriptions through Better Auth's Stripe plugin.",
    brings: [
      "Checkout and customer portal",
      "Webhooks checked against a lifecycle machine",
      "Stays off until keys are set",
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
      "Step order set by a machine, checked by a test",
      "A token-guarded endpoint to start and read runs",
    ],
  },
  {
    name: "r2",
    title: "R2 uploads",
    requires: ["auth"],
    summary: "Per-user file uploads to R2.",
    brings: [
      "Size, type and magic-byte checks",
      "A rate limit per user",
      "An upload machine with retry",
    ],
  },
];

export const CREATE_COMMAND = "bunx create-tanstack-cf-saas my-app";
