import { Schema } from "effect";

const FileUploaded = Schema.TaggedStruct("file_uploaded", {
  contentType: Schema.String.check(Schema.isMaxLength(64)),
  sizeBytes: Schema.Number,
});

export const events = [FileUploaded] as const;

/** What success looks like for this feature, and the catalog events that measure it. */
export const metric = {
  name: "Files uploaded per active user",
  events: ["file_uploaded"],
} as const;
