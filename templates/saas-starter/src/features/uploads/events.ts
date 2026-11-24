import { Schema } from "effect";

const FileUploaded = Schema.TaggedStruct("file_uploaded", {
  contentType: Schema.String.check(Schema.isMaxLength(64)),
  sizeBytes: Schema.Number,
});

export const events = [FileUploaded] as const;
