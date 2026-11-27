import type { BetterAuthPlugin } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Effect } from "effect";
import { setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "#/features/auth/api/auth.ts";
import { Email, type Mail } from "#/features/core/email/api/email.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { codeMail } from "./lib/mails.ts";

/** Better Auth merges these under auth's own options, so sign-in waits for a verified address. */
const requireVerifiedEmail: BetterAuthPlugin = {
  id: "require-verified-email",
  init: () => ({
    options: {
      emailAndPassword: { enabled: true, requireEmailVerification: true },
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
    // shortcut: awaited, so a failed send reaches the user but a known address answers slower
    // than an unknown one; hand the send to waitUntil if that timing ever matters.
    sendVerificationOTP: ({ email, otp, type }) => send({ to: email, ...codeMail(type, otp) }),
  }),
  requireVerifiedEmail,
];

export const authPlugins: AuthPluginFactory = ({ env }) => {
  if (!binding(env, "EMAIL") || !setting(env, "EMAIL_FROM")) return [];
  const email = Email.fromEnv(env);
  return authEmailPlugins((mail) => Effect.runPromise(email.send(mail)));
};
