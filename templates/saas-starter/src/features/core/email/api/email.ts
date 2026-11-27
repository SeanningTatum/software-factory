import { Context, Effect, Layer } from "effect";
import { type AppEnv, CloudflareEnv, setting } from "#/app/env.ts";
import { NotConfigured } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { EmailError } from "../errors.ts";

export interface EmailSender {
  send(message: {
    readonly from: string;
    readonly to: string;
    readonly subject: string;
    readonly text: string;
    readonly html: string;
  }): Promise<unknown>;
}

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const codeOf = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "unknown";

export class Email extends Context.Service<
  Email,
  { readonly send: (mail: Mail) => Effect.Effect<void, EmailError | NotConfigured> }
>()("app/features/email/Email") {
  static readonly fromSender = (sender: EmailSender, from: string) =>
    Email.of({
      send: (mail) =>
        outsideCall(
          "email.send",
          () => sender.send({ from, ...mail }),
          (cause) => new EmailError({ code: codeOf(cause), cause }),
        ).pipe(Effect.asVoid),
    });

  /** Outside a layer, for callers that only have the env, such as a Better Auth plugin. */
  static readonly fromEnv = (env: AppEnv) => {
    const sender = binding<EmailSender>(env, "EMAIL");
    const from = setting(env, "EMAIL_FROM");
    if (sender && from) return Email.fromSender(sender, from);
    const missing = sender ? "EMAIL_FROM" : "EMAIL (send_email binding)";
    return Email.of({ send: () => Effect.fail(new NotConfigured({ setting: missing })) });
  };

  static readonly layer = Layer.effect(
    Email,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      return Email.fromEnv(env);
    }),
  );
}
