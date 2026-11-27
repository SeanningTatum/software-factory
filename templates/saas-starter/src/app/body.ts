import { Effect } from "effect";
import { InvalidInput } from "./errors.ts";

const readAtMost = async (
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

export const readBytes = Effect.fn("readBytes")(function* (request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    return yield* tooLarge(maxBytes);
  if (!request.body) return new Uint8Array(0);
  const body = request.body;
  const bytes = yield* Effect.tryPromise({
    try: () => readAtMost(body, maxBytes),
    catch: () => new InvalidInput({ issues: "unreadable body" }),
  });
  return bytes ?? (yield* tooLarge(maxBytes));
});

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

const MB = 1024 * 1024;
const REQUEST_CAP = MB;
const FORM_OVERHEAD = MB;
const UPLOAD_CAP = 5 * MB + FORM_OVERHEAD;

/**
 * shortcut: a request body with no content-length is refused; count its bytes as they arrive
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
