import { createFileRoute, useRouter } from "@tanstack/react-router";
import { authClient } from "#/blocks/auth/auth-client.ts";
import { ensureSignedIn } from "#/blocks/auth/guard.ts";
import { Button } from "#/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(auth)/dashboard")({
  beforeLoad: ensureSignedIn,
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name}</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              await router.invalidate();
              await router.navigate({ to: "/" });
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
