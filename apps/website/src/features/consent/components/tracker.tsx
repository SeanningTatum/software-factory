import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { reportWebVitals, sendBrowserEvents } from "#/features/core/analytics/lib/browser.ts";
import { useConsent } from "./consent-banner.tsx";

/** Sends a page view on each navigation and web vitals once, but only after consent. */
export function AnalyticsTracker() {
  const { granted } = useConsent();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const vitalsStarted = useRef(false);
  const lastPath = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!granted || lastPath.current === path) return;
    lastPath.current = path;
    sendBrowserEvents([
      {
        _tag: "page_viewed",
        path,
        ...(document.referrer ? { referrer: document.referrer.slice(0, 512) } : {}),
      },
    ]);
  }, [granted, path]);

  useEffect(() => {
    if (!granted || vitalsStarted.current) return;
    vitalsStarted.current = true;
    void reportWebVitals(() => window.location.pathname);
  }, [granted]);

  return null;
}
