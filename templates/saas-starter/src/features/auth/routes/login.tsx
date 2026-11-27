// software-factory-lint allow comments
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { navFor } from "#/app/nav.ts";
import { getSiteKey } from "#/features/auth/api/guard.ts";
import type { Credentials } from "#/features/auth/components/credentials.machine.ts";
import { CredentialsForm } from "#/features/auth/components/credentials-form.tsx";
import { ChallengeRequired, Unverified } from "#/features/auth/errors.ts";
import { authClient } from "#/features/auth/lib/auth-client.ts";
import { afterSignIn, RedirectSearch, toVerify } from "#/features/auth/lib/redirect.ts";
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

const NO_CAPTCHA = "MISSING_RESPONSE";

/** With auth-email on: the address isn't verified yet, and the server has just mailed it a code. */
const UNVERIFIED = "EMAIL_NOT_VERIFIED";

const signIn = async ({ email, password, captcha }: Credentials) => {
  const { error } = await authClient.signIn.email(
    { email, password },
    captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
  );
  if (error?.code === NO_CAPTCHA)
    return Promise.reject(
      new ChallengeRequired("Too many attempts on this account. Complete the check to sign in."),
    );
  if (error?.code === UNVERIFIED) return Promise.reject(new Unverified(email));
  if (error) return Promise.reject(new Error(error.message ?? "Sign-in failed"));
};

function Login() {
  const { redirect } = Route.useSearch();
  const siteKey = Route.useLoaderData();
  const router = useRouter();
  const done = () => void router.invalidate().then(() => router.navigate(afterSignIn(redirect)));
  const [verify] = navFor("verify-email");
  const submit = (credentials: Credentials) =>
    signIn(credentials).catch((error: unknown) => {
      if (error instanceof Unverified && verify)
        void router.navigate(toVerify(verify.to, error.email));
      return Promise.reject(error);
    });
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
            submit={submit}
            onDone={done}
          />
          {navFor("sign-in-help").map((item) => (
            <a key={item.to} href={item.to} className="mt-4 block text-sm underline">
              {item.label}
            </a>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
