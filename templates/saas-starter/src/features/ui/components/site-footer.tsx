import { useConsent } from "#/features/consent/components/consent-banner.tsx";

export function SiteFooter() {
  const { reopen } = useConsent();
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
        <span>Built on TanStack Start and Cloudflare Workers.</span>
        <button type="button" className="underline-offset-4 hover:underline" onClick={reopen}>
          Cookie settings
        </button>
      </div>
    </footer>
  );
}
