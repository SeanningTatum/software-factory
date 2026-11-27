import { Schema } from "effect";

/** `//` or `/\` would send the visitor to another host. */
const LocalPath = Schema.String.check(Schema.isPattern(/^\/(?![/\\])/));

export const RedirectSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ redirect: Schema.optionalKey(LocalPath) }),
);

/**
 * The guard stores the page's full href, search included, so it goes back as an `href`: as a `to`
 * the router would take "?checkout=success" for part of the path.
 */
export const afterSignIn = (redirect: string | undefined) => ({ href: redirect ?? "/dashboard" });
