import { Effect } from "effect";
import { featureViewers } from "#/gen/viewer.ts";

export interface Viewer {
  readonly signedIn: boolean;
  readonly userId?: string;
  readonly email?: string;
  readonly name?: string;
}

export const anonymous: Viewer = { signedIn: false };

export const pickViewer = (viewers: ReadonlyArray<Effect.Effect<Viewer>>): Effect.Effect<Viewer> =>
  viewers[0] ?? Effect.succeed(anonymous);

/** Features' viewers need their own services; the request runtime provides them. */
export const currentViewer = pickViewer(
  featureViewers as unknown as ReadonlyArray<Effect.Effect<Viewer>>,
);
