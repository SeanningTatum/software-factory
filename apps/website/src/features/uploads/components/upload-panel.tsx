import { useRouter } from "@tanstack/react-router";
import { useMachine } from "@xstate/react";
import { useId } from "react";
import { fromPromise } from "xstate";
import { Button } from "#/features/core/ui/components/button.tsx";
import { Label } from "#/features/core/ui/components/label.tsx";
import { useHydrated } from "#/features/core/ui/components/use-hydrated.ts";
import { uploadMachine } from "./upload.machine.ts";

const send = async (file: File) => {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return Promise.reject(new Error(body.message ?? "Upload failed"));
  }
};

export function UploadPanel() {
  const router = useRouter();
  const id = useId();
  const hydrated = useHydrated();
  const [snapshot, dispatch] = useMachine(
    uploadMachine.provide({
      actors: {
        upload: fromPromise(async ({ input }) => {
          await send(input);
          await router.invalidate();
        }),
      },
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id}>Upload a file</Label>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
        disabled={!hydrated || snapshot.matches("uploading")}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) dispatch({ type: "PICK", file });
          event.currentTarget.value = "";
        }}
        className="text-sm"
      />
      {snapshot.matches("uploading") && <p className="text-sm text-muted-foreground">Uploading…</p>}
      {snapshot.matches("done") && <p className="text-sm">Uploaded.</p>}
      {snapshot.context.error && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.context.error}
        </p>
      )}
      {snapshot.matches("failed") && (
        <Button size="sm" className="self-start" onClick={() => dispatch({ type: "RETRY" })}>
          Try again
        </Button>
      )}
    </div>
  );
}
