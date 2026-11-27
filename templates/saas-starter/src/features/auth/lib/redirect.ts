// cf-saas-lint allow comments
import { Schema } from "effect";

const LocalPath = Schema.String.check(Schema.isPattern(/^\/(?![/\\])/));

export const RedirectSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ redirect: Schema.optionalKey(LocalPath) }),
);

export const afterSignIn = (redirect: string | undefined) => ({ href: redirect ?? "/dashboard" });

declare module "@tanstack/react-router" {
  interface HistoryState {
    readonly unverifiedEmail?: string;
  }
}

/** The address rides in history state: a URL would leave it in logs and browser history. */
export const toVerify = (to: string, email: string) => ({
  href: to,
  state: { unverifiedEmail: email },
});
