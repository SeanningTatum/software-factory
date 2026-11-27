import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

/** Added from our own script, which the CSP's nonce allows. */
const load = () => {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start"));
    script.onerror = () => reject(new Error("Turnstile did not load"));
    document.head.appendChild(script);
  }).catch((error: Error) => {
    loading = undefined;
    return Promise.reject(error);
  });
  return loading;
};

interface Props {
  readonly siteKey: string;
  readonly onToken: (token: string | undefined) => void;
}

/** Mount it with a new `key` to get a fresh token: each one works once. */
export function Turnstile({ siteKey, onToken }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const report = useRef(onToken);
  report.current = onToken;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widget: string | undefined;
    let stale = false;
    load().then(
      (api) => {
        if (stale || !box.current) return;
        widget = api.render(box.current, {
          sitekey: siteKey,
          callback: (token) => report.current(token),
          "expired-callback": () => report.current(undefined),
          "error-callback": () => setFailed(true),
        });
      },
      () => setFailed(true),
    );
    return () => {
      stale = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey]);

  return (
    <div>
      <div ref={box} />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          The bot check did not load. Reload the page to try again.
        </p>
      )}
    </div>
  );
}
