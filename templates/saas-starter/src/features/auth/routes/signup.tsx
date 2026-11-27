import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef } from "react";
import { navFor } from "#/app/nav.ts";
import { getSiteKey } from "#/features/auth/api/guard.ts";
import type { Credentials } from "#/features/auth/components/credentials.machine.ts";
import { CredentialsForm } from "#/features/auth/components/credentials-form.tsx";
import { authClient } from "#/features/auth/lib/auth-client.ts";
import { toVerify } from "#/features/auth/lib/redirect.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/features/core/ui/components/card.tsx";

export const Route = createFileRoute("/signup")({
  loader: () => getSiteKey(),
  component: SignUp,
});

const signUp = async ({ email, password, name, captcha }: Credentials) => {
  const { data, error } = await authClient.signUp.email(
    { email, password, name: name ?? "" },
    captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
  );
  if (error) return Promise.reject(new Error(error.message ?? "Sign-up failed"));
  // No session yet: with auth-email on, the address must be verified by code first.
  return data.token ? undefined : email;
};

function SignUp() {
  const router = useRouter();
  const siteKey = Route.useLoaderData();
  const [verify] = navFor("verify-email");
  const unverified = useRef<string | undefined>(undefined);
  const submit = async (credentials: Credentials) => {
    unverified.current = await signUp(credentials);
  };
  const done = () =>
    void router
      .invalidate()
      .then(() =>
        router.navigate(
          verify && unverified.current
            ? toVerify(verify.to, unverified.current)
            : { href: "/dashboard" },
        ),
      );
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Have one already?{" "}
            <Link to="/login" className="underline">
              Sign in
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm
            mode="sign-up"
            siteKey={siteKey ?? undefined}
            submit={submit}
            onDone={done}
          />
        </CardContent>
      </Card>
    </main>
  );
}
