import { Layer } from "effect";
import { Auth } from "./auth-service.ts";
import { AuthRateLimiter } from "./rate-limit.ts";

export const layer = Auth.layer.pipe(Layer.provideMerge(AuthRateLimiter.layer));
