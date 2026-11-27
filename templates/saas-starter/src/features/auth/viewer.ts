import { Effect } from "effect";
import { anonymous, type Viewer } from "#/app/viewer.ts";
import { Auth } from "./api/auth-service.ts";

export const viewer = Effect.gen(function* () {
  const auth = yield* Auth;
  const user = yield* auth.currentUser;
  return user
    ? ({ signedIn: true, userId: user.id, email: user.email, name: user.name } satisfies Viewer)
    : anonymous;
}).pipe(Effect.catch(() => Effect.succeed(anonymous)));
