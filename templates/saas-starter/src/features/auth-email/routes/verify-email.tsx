// cf-saas-lint allow comments
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

export const Route = createFileRoute("/verify-email")({
  // Set by auth's sign-up and sign-in pages; absent after a reload, and the form then asks.
  loader: ({ location }) => location.state.unverifiedEmail ?? null,
  // No cache: a second sign-up would open on the first one's address.
  gcTime: 0,
  component: VerifyEmail,
});

const request = (email: string) =>
  orReject(codeClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }));
const confirm = ({ email, code }: Confirmation) =>
  orReject(codeClient.emailOtp.verifyEmail({ email, otp: code }));

function VerifyEmail() {
  const email = Route.useLoaderData();
  const router = useRouter();
  const done = () => void router.invalidate().then(() => router.navigate({ to: "/dashboard" }));
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Enter the code we emailed you to finish signing in.</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeForm
            {...(email ? { email } : {})}
            confirmLabel="Verify"
            request={request}
            confirm={confirm}
            onDone={done}
          />
        </CardContent>
      </Card>
    </main>
  );
}
