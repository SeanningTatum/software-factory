export type BlockName = "db" | "kv" | "auth" | "billing" | "workflows" | "uploads";

export interface Block {
  readonly name: BlockName;
  readonly summary: string;
  readonly needs: ReadonlyArray<BlockName>;
}

export const BLOCKS_TOP_FIRST: ReadonlyArray<Block> = [
  {
    name: "billing",
    summary: "Stripe subscriptions: checkout, the customer portal and webhooks.",
    needs: ["auth"],
  },
  { name: "uploads", summary: "Per-user files in R2, checked for size and type.", needs: ["auth"] },
  { name: "auth", summary: "Email and password sign-in, sessions and rate limits.", needs: ["db"] },
  {
    name: "db",
    summary: "A Cloudflare D1 database through Drizzle, tested with real SQL.",
    needs: [],
  },
  { name: "kv", summary: "A typed Workers KV store with a read-through cache.", needs: [] },
  { name: "workflows", summary: "A durable onboarding flow on Cloudflare Workflows.", needs: [] },
];

const CLI_ORDER: ReadonlyArray<BlockName> = ["db", "kv", "auth", "billing", "workflows", "uploads"];

const needsOf = (name: BlockName): ReadonlyArray<BlockName> =>
  BLOCKS_TOP_FIRST.find((block) => block.name === name)?.needs ?? [];

const withNeeds = (name: BlockName): ReadonlyArray<BlockName> => [
  name,
  ...needsOf(name).flatMap(withNeeds),
];

const withDependents = (name: BlockName): ReadonlyArray<BlockName> => [
  name,
  ...BLOCKS_TOP_FIRST.filter((block) => block.needs.includes(name)).flatMap((block) =>
    withDependents(block.name),
  ),
];

export const toggleBlock = (
  picked: ReadonlyArray<BlockName>,
  name: BlockName,
): ReadonlyArray<BlockName> => {
  const next = picked.includes(name)
    ? picked.filter((block) => !withDependents(name).includes(block))
    : [...picked, ...withNeeds(name)];
  return CLI_ORDER.filter((block) => next.includes(block));
};

export const CREATE_COMMAND = "bunx @seanningtatum/create-software-factory my-app";

export const featuresFlag = (picked: ReadonlyArray<BlockName>): string =>
  CLI_ORDER.filter((block) => picked.includes(block)).join(",");

export const commandFor = (picked: ReadonlyArray<BlockName>): string =>
  picked.length === 0 ? CREATE_COMMAND : `${CREATE_COMMAND} --features ${featuresFlag(picked)}`;

export const blockNamed = (value: string): BlockName | undefined =>
  BLOCKS_TOP_FIRST.find((block) => block.name === value)?.name;
