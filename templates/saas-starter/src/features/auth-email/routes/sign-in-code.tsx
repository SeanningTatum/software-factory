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

export const Route = createFileRoute("/sign-in-code")({ component: SignInCode });

const request = (email: string) =>
  orReject(codeClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }));
const confirm = ({ email, code }: Confirmation) =>
  orReject(codeClient.signIn.emailOtp({ email, otp: code }));

function SignInCode() {
  const router = useRouter();
  const done = () => void router.invalidate().then(() => router.navigate({ to: "/dashboard" }));
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in with a code</CardTitle>
          <CardDescription>We'll email you a code; no password needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeForm confirmLabel="Sign in" request={request} confirm={confirm} onDone={done} />
        </CardContent>
      </Card>
    </main>
  );
}
