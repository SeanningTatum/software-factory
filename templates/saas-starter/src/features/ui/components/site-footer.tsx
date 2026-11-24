import { useConsent } from "#/features/consent/components/consent-banner.tsx";
import { useHydrated } from "./use-hydrated.ts";

export function SiteFooter() {
  const { reopen } = useConsent();
  const hydrated = useHydrated();
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
        <span>Built on TanStack Start and Cloudflare Workers.</span>
        <button
          type="button"
          className="underline-offset-4 hover:underline disabled:opacity-50"
          disabled={!hydrated}
          onClick={reopen}
        >
          Cookie settings
        </button>
      </div>
    </footer>
  );
}
