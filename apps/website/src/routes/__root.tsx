/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getShell } from "#/app/shell.ts";
import { AnalyticsTracker } from "#/features/analytics/components/tracker.tsx";
import { ConsentProvider } from "#/features/consent/components/consent-banner.tsx";
import { SiteFooter } from "#/features/ui/components/site-footer.tsx";
import { SiteHeader } from "#/features/ui/components/site-header.tsx";
import appCss from "../styles.css?url";

export const APP_NAME = "tanstack-cf-saas";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
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
  return (
    <ConsentProvider input={consent}>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader signedIn={viewer.signedIn} appName={APP_NAME} />
        <div className="flex-1">
          <Outlet />
        </div>
        <SiteFooter />
      </div>
      <AnalyticsTracker />
    </ConsentProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
