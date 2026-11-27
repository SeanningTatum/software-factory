import { createFileRoute, Link } from "@tanstack/react-router";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { Card, CardContent, CardHeader, CardTitle } from "#/features/core/ui/components/card.tsx";
import { CursorSearch, listFiles } from "#/features/uploads/api/loaders.ts";
import type { FilePage } from "#/features/uploads/api/uploads.ts";
import { UploadPanel } from "#/features/uploads/components/upload-panel.tsx";

export const Route = createFileRoute("/uploads")({
  beforeLoad: ensureSignedIn,
  validateSearch: CursorSearch,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: ({ deps }) => listFiles({ data: deps.cursor ? { cursor: deps.cursor } : {} }),
  component: UploadsPage,
});

const KB = 1024;

function UploadsPage() {
  const { files, cursor }: FilePage = Route.useLoaderData();
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
                <li key={file.id} className="flex items-center justify-between py-2">
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
          {cursor && (
            <Link to="/uploads" search={{ cursor }} className="self-start text-sm underline">
              More
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
