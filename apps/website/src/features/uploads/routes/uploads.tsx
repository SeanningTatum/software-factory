import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { Card, CardContent, CardHeader, CardTitle } from "#/features/ui/components/card.tsx";
import { prefixFor, type StoredFile, Uploads } from "#/features/uploads/api/uploads.ts";
import { UploadPanel } from "#/features/uploads/components/upload-panel.tsx";

const listFiles = createServerFn({ method: "GET" }).handler(({ context }) =>
  runEffect(
    context,
    Effect.gen(function* () {
      const user = yield* (yield* Auth).requireUser;
      const files = yield* (yield* Uploads).list(user.id);
      return files.map((file) => ({ ...file, id: file.key.slice(prefixFor(user.id).length) }));
    }),
    "uploads.page",
  ),
);

export const Route = createFileRoute("/uploads")({
  beforeLoad: ensureSignedIn,
  loader: () => listFiles(),
  component: UploadsPage,
});

const KB = 1024;

function UploadsPage() {
  const files: ReadonlyArray<StoredFile & { id: string }> = Route.useLoaderData();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <UploadPanel />
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {files.map((file) => (
                <li key={file.key} className="flex items-center justify-between py-2">
                  <a
                    href={`/api/uploads/${file.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {file.name}
                  </a>
                  <span className="text-muted-foreground">{Math.ceil(file.size / KB)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
