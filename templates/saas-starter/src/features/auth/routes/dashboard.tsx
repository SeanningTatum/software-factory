import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { authClient } from "#/features/auth/lib/auth-client.ts";
import { Button } from "#/features/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/features/ui/components/card.tsx";

export const Route = createFileRoute("/dashboard")({
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
