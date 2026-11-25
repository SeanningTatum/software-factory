import { useMachine } from "@xstate/react";
import { useId, useState } from "react";
import { fromPromise } from "xstate";
import { Button } from "#/features/core/ui/components/button.tsx";
import { Input } from "#/features/core/ui/components/input.tsx";
import { Label } from "#/features/core/ui/components/label.tsx";
import { type Credentials, credentialsMachine } from "./credentials.machine.ts";
import { Turnstile } from "./turnstile.tsx";

interface Props {
  readonly mode: "sign-in" | "sign-up";
  readonly submit: (credentials: Credentials) => Promise<void>;
  readonly onDone: () => void;
  /** Turnstile site key: when set, the form shows the check and sends its token with the submit. */
  readonly siteKey?: string;
}

export function CredentialsForm({ mode, submit, onDone, siteKey }: Props) {
  const [snapshot, send] = useMachine(
    credentialsMachine.provide({ actors: { submit: fromPromise(({ input }) => submit(input)) } }),
  );
  const id = useId();
  const [token, setToken] = useState<string>();
  // A token works once; a new `key` mounts a new check for the next try.
  const [attempt, setAttempt] = useState(0);
  if (snapshot.status === "done") queueMicrotask(onDone);
  const busy = snapshot.matches("submitting") || snapshot.status === "done";

  return (
    // POST, so a submit that somehow lands before hydration never puts the password in the URL.
    // The button stays disabled until then (see Button), which also blocks submitting with Enter.
    <form
      method="post"
      className="flex flex-col gap-4"
      onChange={() => snapshot.matches("failed") && send({ type: "EDIT" })}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (siteKey) {
          setToken(undefined);
          setAttempt((n) => n + 1);
        }
        send({
          type: "SUBMIT",
          credentials: {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            ...(mode === "sign-up" ? { name: String(form.get("name") ?? "") } : {}),
            ...(siteKey ? { captcha: token } : {}),
          },
        });
      }}
    >
      {mode === "sign-up" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} name="name" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-password`}>Password</Label>
        <Input
          id={`${id}-password`}
          name="password"
          type="password"
          minLength={10}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
        />
      </div>
      {siteKey && <Turnstile key={attempt} siteKey={siteKey} onToken={setToken} />}
      {snapshot.context.error && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.context.error}
        </p>
      )}
      <Button type="submit" disabled={busy || (Boolean(siteKey) && !token)}>
        {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
