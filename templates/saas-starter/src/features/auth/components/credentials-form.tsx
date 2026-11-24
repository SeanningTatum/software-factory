import { useMachine } from "@xstate/react";
import { useId } from "react";
import { fromPromise } from "xstate";
import { Button } from "#/features/ui/components/button.tsx";
import { Input } from "#/features/ui/components/input.tsx";
import { Label } from "#/features/ui/components/label.tsx";
import { type Credentials, credentialsMachine } from "./credentials.machine.ts";

interface Props {
  readonly mode: "sign-in" | "sign-up";
  readonly submit: (credentials: Credentials) => Promise<void>;
  readonly onDone: () => void;
}

export function CredentialsForm({ mode, submit, onDone }: Props) {
  const [snapshot, send] = useMachine(
    credentialsMachine.provide({ actors: { submit: fromPromise(({ input }) => submit(input)) } }),
  );
  const id = useId();
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
        send({
          type: "SUBMIT",
          credentials: {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            ...(mode === "sign-up" ? { name: String(form.get("name") ?? "") } : {}),
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
      {snapshot.context.error && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.context.error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
