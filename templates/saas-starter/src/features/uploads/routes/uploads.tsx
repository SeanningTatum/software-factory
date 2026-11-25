import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { Card, CardContent, CardHeader, CardTitle } from "#/features/core/ui/components/card.tsx";
import { type FilePage, Uploads } from "#/features/uploads/api/uploads.ts";
import { UploadPanel } from "#/features/uploads/components/upload-panel.tsx";

/** The `?cursor=` of the next page: R2's opaque token, passed back as it came. */
const CursorSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(512))) }),
);

const listFiles = createServerFn({ method: "GET" })
  .validator(CursorSearch)
  .handler(({ context, data }) =>
    runEffect(
      context,
      Effect.gen(function* () {
        const auth = yield* Auth;
        const user = yield* auth.requireUser;
        const uploads = yield* Uploads;
        return yield* uploads.list(user.id, data.cursor);
      }),
      "uploads.page",
    ),
  );

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
