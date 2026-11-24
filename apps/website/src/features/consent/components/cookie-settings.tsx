import { useHydrated } from "#/features/core/ui/components/use-hydrated.ts";
import { useConsent } from "./consent-banner.tsx";

/** Opens the consent banner again, so a visitor can change their answer. */
export function CookieSettingsButton() {
  const { reopen } = useConsent();
  const hydrated = useHydrated();
  return (
    <button
      type="button"
      className="underline-offset-4 hover:underline disabled:opacity-50"
      disabled={!hydrated}
      onClick={reopen}
    >
      Cookie settings
    </button>
  );
}
