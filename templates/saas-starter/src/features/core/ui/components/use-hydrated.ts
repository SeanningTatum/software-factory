import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * Controls that only work with JavaScript stay disabled until React hydrates, so a click before
 * then does nothing instead of submitting a form natively (which would put its fields in the URL).
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
