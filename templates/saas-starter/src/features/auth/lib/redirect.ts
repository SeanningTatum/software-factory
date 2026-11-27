import { Schema } from "effect";

const LocalPath = Schema.String.check(Schema.isPattern(/^\/(?![/\\])/));

export const RedirectSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ redirect: Schema.optionalKey(LocalPath) }),
);

export const afterSignIn = (redirect: string | undefined) => ({ href: redirect ?? "/dashboard" });
