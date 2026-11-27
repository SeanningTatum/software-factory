import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { Email } from "./email.ts";
import { memorySender } from "./memory-sender.ts";

const mail = { to: "ada@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

const sendWith = (env: Record<string, unknown>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const email = yield* Email;
      return yield* email.send(mail);
    }).pipe(
      Effect.provide(
        Email.layer.pipe(Layer.provide(CloudflareEnv.layer(env as unknown as AppEnv))),
      ),
      Effect.flip,
    ),
  );

describe("Email", () => {
  it("sends through the binding from EMAIL_FROM", async () => {
    const { sender, sent } = memorySender();
    await Effect.runPromise(Email.fromSender(sender, "hello@example.com").send(mail));
    expect(sent).toEqual([{ from: "hello@example.com", ...mail }]);
  });

  it("fails with the service's error code when the send is refused", async () => {
    const refused = Object.assign(new Error("no"), { code: "E_SENDER_DOMAIN_NOT_AVAILABLE" });
    const sender = { send: () => Promise.reject(refused) };
    const error = await Effect.runPromise(
      Email.fromSender(sender, "hello@example.com").send(mail).pipe(Effect.flip),
    );
    expect(error).toMatchObject({ _tag: "EmailError", code: "E_SENDER_DOMAIN_NOT_AVAILABLE" });
  });

  it("names the missing binding or sender instead of sending", async () => {
    expect(await sendWith({})).toMatchObject({ setting: "EMAIL (send_email binding)" });
    expect(await sendWith({ EMAIL: memorySender().sender })).toMatchObject({
      setting: "EMAIL_FROM",
    });
  });
});
