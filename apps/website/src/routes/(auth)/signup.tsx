import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { authClient } from "#/blocks/auth/auth-client.ts";
import { CredentialsForm } from "#/blocks/auth/ui/credentials-form.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignUp,
});

function SignUp() {
  const router = useRouter();
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
            submit={async ({ email, password, name }) => {
              const { error } = await authClient.signUp.email({
                email,
                password,
                name: name ?? "",
              });
              if (error) return Promise.reject(new Error(error.message ?? "Sign-up failed"));
            }}
            onDone={() =>
              void router.invalidate().then(() => router.navigate({ to: "/dashboard" }))
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
