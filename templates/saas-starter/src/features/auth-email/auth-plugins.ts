// software-factory-lint allow comments
import type { BetterAuthPlugin } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Effect } from "effect";
import { setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "#/features/auth/api/auth.ts";
import { Email, type Mail } from "#/features/core/email/api/email.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { CODE_LENGTH } from "./constants.ts";
import { codeMail } from "./lib/mails.ts";

/** Better Auth merges these under auth's own options: sign-in waits for a verified address. */
const requireVerifiedEmail: BetterAuthPlugin = {
  id: "require-verified-email",
  init: () => ({
    options: {
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        // A reset is how an owner locks a thief out. The session cookie cache keeps a revoked
        // session alive for up to five minutes.
        revokeSessionsOnPasswordReset: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
      },
    },
  }),
};

export const authEmailPlugins = (
  send: (mail: Mail) => Promise<void>,
): ReadonlyArray<BetterAuthPlugin> => [
  emailOTP({
    overrideDefaultEmailVerification: true,
    // A code for an address with no account would make one, past the sign-up form and its check.
    disableSignUp: true,
    storeOTP: "hashed",
    otpLength: CODE_LENGTH,
    // Better Auth answers success even when this rejects, so the caller of `authEmailPlugins`
    // must record a failed send itself; the page can't tell the user.
    sendVerificationOTP: ({ email, otp, type }) => send({ to: email, ...codeMail(type, otp) }),
  }),
  requireVerifiedEmail,
];

export const authPlugins: AuthPluginFactory = ({ env, onWarning }) => {
  if (!binding(env, "EMAIL") || !setting(env, "EMAIL_FROM")) return [];
  const email = Email.fromEnv(env);
  return authEmailPlugins((mail) =>
    Effect.runPromise(
      email.send(mail).pipe(
        Effect.tapError((error) =>
          Effect.sync(() =>
            onWarning("code mail not sent", {
              error: error._tag,
              reason: error._tag === "EmailError" ? error.code : error.setting,
            }),
          ),
        ),
      ),
    ),
  );
};
