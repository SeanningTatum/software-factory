import { Effect } from "effect";
import { InvalidInput } from "./errors.ts";

/** Reads a JSON body no larger than `maxBytes`. Oversized or malformed bodies fail with InvalidInput. */
export const readBody = Effect.fn("readBody")(function* (request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes)
    return yield* new InvalidInput({ issues: `body over ${maxBytes} bytes` });
  const text = yield* Effect.tryPromise({
    try: () => request.text(),
    catch: () => new InvalidInput({ issues: "unreadable body" }),
  });
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return yield* new InvalidInput({ issues: `body over ${maxBytes} bytes` });
  }
  return yield* Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new InvalidInput({ issues: "not JSON" }),
  });
});
