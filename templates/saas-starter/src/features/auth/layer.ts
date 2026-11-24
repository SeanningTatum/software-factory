import { Layer } from "effect";
import { Auth } from "./api/auth-service.ts";
import { AuthRateLimiter } from "./api/rate-limit.ts";

export const layer = Auth.layer.pipe(Layer.provideMerge(AuthRateLimiter.layer));
