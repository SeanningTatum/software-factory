import type { Metric } from "web-vitals";
import type { BrowserEvent } from "../events.ts";

export const EVENTS_ENDPOINT = "/api/events";

export const ANON_ID_COOKIE = "aid";
const ANON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ONE_YEAR = 60 * 60 * 24 * 365;

export const readAnonId = (cookies: string | null | undefined): string | undefined => {
  const value = cookies
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${ANON_ID_COOKIE}=`))
    ?.slice(ANON_ID_COOKIE.length + 1);
  return value && ANON_ID.test(value) ? value : undefined;
};

export const anonIdCookie = (id: string) =>
  `${ANON_ID_COOKIE}=${id}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`;
export const clearAnonIdCookie = `${ANON_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;

export const browserDistinctId = (
  userId: string | undefined,
  cookies: string | null,
  requestId: string,
) => userId ?? `anon:${readAnonId(cookies) ?? requestId}`;

export const sendBrowserEvents = (events: ReadonlyArray<BrowserEvent>) => {
  const body = JSON.stringify({ events });
  if (navigator.sendBeacon?.(EVENTS_ENDPOINT, new Blob([body], { type: "application/json" })))
    return;
  void fetch(EVENTS_ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "application/json" },
  });
};

export const vitalEvent = (metric: Metric, path: string): BrowserEvent => ({
  _tag: "web_vital",
  metric: metric.name,
  value: metric.value,
  rating: metric.rating,
  path,
});

export const reportWebVitals = async (path: () => string) => {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
  const send = (metric: Metric) => sendBrowserEvents([vitalEvent(metric, path())]);
  for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) on(send);
};
