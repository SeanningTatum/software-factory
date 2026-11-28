import type { ReactNode } from "react";

export function SiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
        <span>Free and open source. Not affiliated with Cloudflare.</span>
        {children}
      </div>
    </footer>
  );
}
