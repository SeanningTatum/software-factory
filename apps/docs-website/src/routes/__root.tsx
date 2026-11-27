// software-factory-lint allow comments
/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import type { ReactNode } from "react";
import { getShell } from "#/app/shell.ts";
import { ConsentProvider } from "#/features/consent/components/consent-banner.tsx";
import { CookieSettingsButton } from "#/features/consent/components/cookie-settings.tsx";
import { AnalyticsTracker } from "#/features/consent/components/tracker.tsx";
import { SiteFooter } from "#/features/core/ui/components/site-footer.tsx";
import { SiteHeader } from "#/features/core/ui/components/site-header.tsx";
import appCss from "../styles.css?url";

export const APP_NAME = "Software Factory for Cloudflare Workers";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Compose a SaaS from blocks with one command: TanStack Start on Cloudflare Workers, with a harness for Claude Code.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  loader: () => getShell(),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <main className="mx-auto max-w-5xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
    </main>
  ),
});

function RootComponent() {
  const { viewer, consent } = Route.useLoaderData();
  // The theme script is inline: without the nonce the production CSP blocks it.
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <RootProvider theme={{ nonce }}>
      <ConsentProvider input={consent}>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader signedIn={viewer.signedIn} appName={APP_NAME} />
          <div className="flex-1">
            <Outlet />
          </div>
          <SiteFooter>
            <CookieSettingsButton />
          </SiteFooter>
        </div>
        <AnalyticsTracker />
      </ConsentProvider>
    </RootProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
