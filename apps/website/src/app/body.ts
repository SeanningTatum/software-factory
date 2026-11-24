import { Effect } from "effect";
import { InvalidInput } from "./errors.ts";

/** Reads a stream, stopping and cancelling it once more than `maxBytes` have arrived. */
const collect = async (
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  const reader = body.getReader();
  const chunks: Array<Uint8Array> = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const tooLarge = (maxBytes: number) => new InvalidInput({ issues: `body over ${maxBytes} bytes` });

/**
 * The request body, at most `maxBytes`. Counts the bytes as they arrive, so a chunked body with no
 * content-length is cut off at the limit instead of being read whole.
 */
export const readBytes = Effect.fn("readBytes")(function* (request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    return yield* tooLarge(maxBytes);
  if (!request.body) return new Uint8Array(0);
  const body = request.body;
  const bytes = yield* Effect.tryPromise({
    try: () => collect(body, maxBytes),
    catch: () => new InvalidInput({ issues: "unreadable body" }),
  });
  return bytes ?? (yield* tooLarge(maxBytes));
});

/** Reads a JSON body no larger than `maxBytes`. Oversized or malformed bodies fail with InvalidInput. */
export const readBody = Effect.fn("readBody")(function* (request: Request, maxBytes: number) {
  const text = new TextDecoder().decode(yield* readBytes(request, maxBytes));
  return yield* Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new InvalidInput({ issues: "not JSON" }),
  });
});

/** Reads a multipart or urlencoded form no larger than `maxBytes`. */
export const readForm = Effect.fn("readForm")(function* (request: Request, maxBytes: number) {
  const bytes = yield* readBytes(request, maxBytes);
  const contentType = request.headers.get("content-type") ?? "";
  return yield* Effect.tryPromise({
    try: () => new Response(bytes, { headers: { "content-type": contentType } }).formData(),
    catch: () => new InvalidInput({ issues: "expected form data" }),
  });
});
