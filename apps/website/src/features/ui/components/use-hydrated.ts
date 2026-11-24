import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False on the server and during hydration, true once React runs in the browser. Controls that only
 * work with JavaScript use it to stay disabled until then, so a click before hydration does nothing
 * instead of submitting a form natively (which would put its fields in the URL).
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
