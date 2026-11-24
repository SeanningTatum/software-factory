import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { authClient } from "#/blocks/auth/auth-client.ts";
import { CredentialsForm } from "#/blocks/auth/ui/credentials-form.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";

const Search = Schema.toStandardSchemaV1(
  Schema.Struct({ redirect: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\//))) }),
);

export const Route = createFileRoute("/(auth)/login")({
  validateSearch: Search,
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
              void router.invalidate().then(() => router.navigate({ to: redirect ?? "/dashboard" }))
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
