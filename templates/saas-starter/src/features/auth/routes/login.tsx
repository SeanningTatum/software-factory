import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { getSiteKey } from "#/features/auth/api/guard.ts";
import type { Credentials } from "#/features/auth/components/credentials.machine.ts";
import { CredentialsForm } from "#/features/auth/components/credentials-form.tsx";
import { ChallengeRequired } from "#/features/auth/errors.ts";
import { authClient } from "#/features/auth/lib/auth-client.ts";
import { afterSignIn, RedirectSearch } from "#/features/auth/lib/redirect.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/features/core/ui/components/card.tsx";

export const Route = createFileRoute("/login")({
  validateSearch: RedirectSearch,
  loader: () => getSiteKey(),
  component: Login,
});

/** Better Auth's captcha plugin: this account is past its limit, so the server wants a token. */
const NO_CAPTCHA = "MISSING_RESPONSE";

const signIn = async ({ email, password, captcha }: Credentials) => {
  const { error } = await authClient.signIn.email(
    { email, password },
    captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
  );
  if (error?.code === NO_CAPTCHA)
    return Promise.reject(
      new ChallengeRequired("Too many attempts on this account. Complete the check to sign in."),
    );
  if (error) return Promise.reject(new Error(error.message ?? "Sign-in failed"));
};

function Login() {
  const { redirect } = Route.useSearch();
  const siteKey = Route.useLoaderData();
  const router = useRouter();
  const done = () => void router.invalidate().then(() => router.navigate(afterSignIn(redirect)));
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            No account?{" "}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm
            mode="sign-in"
            siteKey={siteKey ?? undefined}
            submit={signIn}
            onDone={done}
          />
        </CardContent>
      </Card>
    </main>
  );
}
