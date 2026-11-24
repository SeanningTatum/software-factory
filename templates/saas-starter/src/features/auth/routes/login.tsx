import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { CredentialsForm } from "#/features/auth/components/credentials-form.tsx";
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
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
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
            submit={async ({ email, password }) => {
              const { error } = await authClient.signIn.email({ email, password });
              if (error) return Promise.reject(new Error(error.message ?? "Sign-in failed"));
            }}
            onDone={() =>
              void router.invalidate().then(() => router.navigate(afterSignIn(redirect)))
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
