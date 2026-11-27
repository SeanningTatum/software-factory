import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { Confirmation } from "#/features/auth-email/components/code.machine.ts";
import { CodeForm } from "#/features/auth-email/components/code-form.tsx";
import { codeClient, orReject } from "#/features/auth-email/lib/code-client.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/features/core/ui/components/card.tsx";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

const request = (email: string) => orReject(codeClient.emailOtp.requestPasswordReset({ email }));
const confirm = ({ email, code, password }: Confirmation) =>
  orReject(codeClient.emailOtp.resetPassword({ email, otp: code, password: password ?? "" }));

function ForgotPassword() {
  const router = useRouter();
  const done = () => void router.navigate({ to: "/login" });
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We'll email you a code to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeForm
            withPassword
            confirmLabel="Set new password"
            request={request}
            confirm={confirm}
            onDone={done}
          />
        </CardContent>
      </Card>
    </main>
  );
}
