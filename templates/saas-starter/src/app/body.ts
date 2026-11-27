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

export const readForm = Effect.fn("readForm")(function* (request: Request, maxBytes: number) {
  const bytes = yield* readBytes(request, maxBytes);
  const contentType = request.headers.get("content-type") ?? "";
  return yield* Effect.tryPromise({
    try: () => new Response(bytes, { headers: { "content-type": contentType } }).formData(),
    catch: () => new InvalidInput({ issues: "expected form data" }),
  });
});

const REQUEST_CAP = 1024 * 1024;
// A 5 MB file plus form overhead; the upload route cuts the exact limit itself.
const UPLOAD_CAP = 6 * 1024 * 1024;

/**
 * A 413 (over the cap) or 411 (no content-length) for a request with a body, else undefined. Runs
 * before any route reads the body, so auth routes and the Stripe webhook cannot be made to buffer
 * a huge one. Stripe, browsers and fetch all send a content-length.
 * shortcut: a chunked body with no content-length is refused; count its bytes as they arrive
 * instead if a client must be allowed to send one.
 */
export const bodyTooLarge = (request: Request): Response | undefined => {
  if (!request.body) return undefined;
  const cap = new URL(request.url).pathname.startsWith("/api/uploads") ? UPLOAD_CAP : REQUEST_CAP;
  const length = request.headers.get("content-length");
  if (length === null) return Response.json({ message: "Length required" }, { status: 411 });
  return Number(length) > cap
    ? Response.json({ message: "Request body too large" }, { status: 413 })
    : undefined;
};
