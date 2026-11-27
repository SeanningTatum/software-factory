import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  anonIdCookie,
  readAnonId,
  reportWebVitals,
  sendBrowserEvents,
} from "#/features/core/analytics/lib/browser.ts";
import { useConsent } from "./consent-banner.tsx";

export function AnalyticsTracker() {
  const { granted } = useConsent();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const vitalsStarted = useRef(false);
  const lastPath = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!granted || lastPath.current === path) return;
    lastPath.current = path;
    if (!readAnonId(document.cookie)) {
      // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet.
      document.cookie = anonIdCookie(crypto.randomUUID());
    }
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
