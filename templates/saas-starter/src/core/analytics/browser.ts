import type { Metric } from "web-vitals";
import type { BrowserEvent } from "./events.ts";

export const EVENTS_ENDPOINT = "/api/events";

/** Sends browser events to our own endpoint, so no third-party host joins the CSP. */
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

/** Starts web vitals reporting; each metric is sent once it is final. */
export const reportWebVitals = async (path: () => string) => {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
  const send = (metric: Metric) => sendBrowserEvents([vitalEvent(metric, path())]);
  for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) on(send);
};
