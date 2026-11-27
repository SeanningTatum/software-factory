import type { ReactNode } from "react";

/** `children` go on the right, e.g. the cookie settings button. */
export function SiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
        <span>Built on TanStack Start and Cloudflare Workers.</span>
        {children}
      </div>
    </footer>
  );
}
