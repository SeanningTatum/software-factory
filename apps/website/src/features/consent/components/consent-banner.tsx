import { useMachine } from "@xstate/react";
import { createContext, type ReactNode, useContext } from "react";
import { Button } from "#/features/ui/components/button.tsx";
import { consentCookie } from "../lib/consent.ts";
import { type ConsentInput, consentMachine } from "./consent.machine.ts";

type ConsentState = { readonly granted: boolean; readonly reopen: () => void };
const ConsentContext = createContext<ConsentState>({ granted: false, reopen: () => undefined });

/** Whether the browser may send analytics, and a way to change the answer. */
export const useConsent = () => useContext(ConsentContext);

export function ConsentProvider({ input, children }: { input: ConsentInput; children: ReactNode }) {
  const [snapshot, send] = useMachine(
    consentMachine.provide({
      actions: {
        persist: (_, { choice }) => {
          // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet.
          document.cookie = consentCookie(choice);
        },
      },
    }),
    { input },
  );
  const value = { granted: snapshot.matches("granted"), reopen: () => send({ type: "REOPEN" }) };
  return (
    <ConsentContext.Provider value={value}>
      {children}
      {snapshot.matches("asking") && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm">
            We'd like to count page views and measure load times to improve the site. No ads, no
            tracking across sites.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => send({ type: "DECLINE" })}>
              No thanks
            </Button>
            <Button size="sm" onClick={() => send({ type: "ACCEPT" })}>
              Allow
            </Button>
          </div>
        </div>
      )}
    </ConsentContext.Provider>
  );
}
