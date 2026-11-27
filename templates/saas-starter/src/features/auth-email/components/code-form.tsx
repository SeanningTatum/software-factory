import { useMachine } from "@xstate/react";
import { type FormEvent, useId } from "react";
import { fromPromise } from "xstate";
import { Button } from "#/features/core/ui/components/button.tsx";
import { Input } from "#/features/core/ui/components/input.tsx";
import { Label } from "#/features/core/ui/components/label.tsx";
import { type Confirmation, codeMachine } from "./code.machine.ts";

interface Props {
  /** Known already, so the code step shows first: the code was sent before the page opened. */
  readonly email?: string;
  readonly withPassword?: boolean;
  readonly confirmLabel: string;
  readonly request: (email: string) => Promise<void>;
  readonly confirm: (confirmation: Confirmation) => Promise<void>;
  readonly onDone: () => void;
}

export function CodeForm({ email, withPassword, confirmLabel, request, confirm, onDone }: Props) {
  const [snapshot, send] = useMachine(
    codeMachine.provide({
      actors: {
        request: fromPromise(({ input }) => request(input)),
        confirm: fromPromise(({ input }) => confirm(input)),
      },
    }),
    { input: { ...(email ? { email } : {}) } },
  );
  const id = useId();
  if (snapshot.status === "done") queueMicrotask(onDone);
  const askingEmail = snapshot.matches("email") || snapshot.matches("requesting");
  const busy =
    snapshot.matches("requesting") || snapshot.matches("confirming") || snapshot.status === "done";

  const edit = () => snapshot.context.error && send({ type: "EDIT" });
  const resend = () => send({ type: "RESEND" });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (askingEmail) return send({ type: "REQUEST", email: String(form.get("email") ?? "") });
    const password = String(form.get("password") ?? "");
    send({
      type: "CONFIRM",
      code: String(form.get("code") ?? ""),
      ...(password ? { password } : {}),
    });
  };

  return (
    <form method="post" className="flex flex-col gap-4" onChange={edit} onSubmit={onSubmit}>
      {askingEmail ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input id={`${id}-email`} name="email" type="email" autoComplete="email" required />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            If {snapshot.context.email} has an account, we sent it a 6-digit code.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-code`}>Code</Label>
            <Input
              id={`${id}-code`}
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </div>
          {withPassword && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-password`}>New password</Label>
              <Input
                id={`${id}-password`}
                name="password"
                type="password"
                minLength={10}
                autoComplete="new-password"
                required
              />
            </div>
          )}
        </>
      )}
      {snapshot.context.error && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.context.error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Please wait…" : askingEmail ? "Email me a code" : confirmLabel}
      </Button>
      {!askingEmail && (
        <Button type="button" variant="ghost" disabled={busy} onClick={resend}>
          Send a new code
        </Button>
      )}
    </form>
  );
}
