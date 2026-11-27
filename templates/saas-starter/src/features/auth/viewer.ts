import { Effect } from "effect";
import { anonymous, type Viewer } from "#/app/viewer.ts";
import { Auth } from "./api/auth-service.ts";

/** Any auth problem shows the page as signed out. */
export const viewer = Effect.gen(function* () {
  const auth = yield* Auth;
  const user = yield* auth.currentUser;
  return user
    ? ({ signedIn: true, userId: user.id, email: user.email, name: user.name } satisfies Viewer)
    : anonymous;
}).pipe(Effect.catch(() => Effect.succeed(anonymous)));
