import { Effect } from "effect";
import { blockViewers } from "#/gen/viewer.ts";

/** Who is looking at the page. Blocks that know (auth) provide it through a `viewer.ts`. */
export interface Viewer {
  readonly signedIn: boolean;
  readonly userId?: string;
  readonly email?: string;
  readonly name?: string;
}

export const anonymous: Viewer = { signedIn: false };

/** The first block's answer, or anonymous when no block knows about users. */
export const pickViewer = (viewers: ReadonlyArray<Effect.Effect<Viewer>>): Effect.Effect<Viewer> =>
  viewers[0] ?? Effect.succeed(anonymous);

/** Blocks' viewers need their own services; the request runtime provides them. */
export const currentViewer = pickViewer(
  blockViewers as unknown as ReadonlyArray<Effect.Effect<Viewer>>,
);
