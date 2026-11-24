/** What uploads may contain, recognised by their first bytes rather than by what the browser claims. */
const ALLOWED = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
} as const satisfies Record<string, ReadonlyArray<number>>;

export type AllowedType = keyof typeof ALLOWED;
export const MAX_BYTES = 5 * 1024 * 1024;
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50];
const WEBP_TAG_OFFSET = 8;

export type Rejection = "empty" | "too_large" | "unsupported_type" | "type_mismatch";

const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>, offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/** The real type of a file from its first bytes, or undefined when it is not one we accept. */
export const sniff = (head: Uint8Array): AllowedType | undefined =>
  (Object.keys(ALLOWED) as Array<AllowedType>).find(
    (type) =>
      startsWith(head, ALLOWED[type]) &&
      (type !== "image/webp" || startsWith(head, WEBP_TAG, WEBP_TAG_OFFSET)),
  );

/** Checks a file before upload (in the browser) or before storing it (on the server). */
export const check = (
  file: { size: number; type: string },
  head?: Uint8Array,
): Rejection | undefined => {
  if (file.size === 0) return "empty";
  if (file.size > MAX_BYTES) return "too_large";
  if (!(file.type in ALLOWED)) return "unsupported_type";
  if (head && sniff(head) !== file.type) return "type_mismatch";
  return undefined;
};

export const rejectionMessage: Record<Rejection, string> = {
  empty: "That file is empty.",
  too_large: "Files can be up to 5 MB.",
  unsupported_type: "Upload a PNG, JPEG, GIF, WebP or PDF.",
  type_mismatch: "That file's contents don't match its type.",
};
