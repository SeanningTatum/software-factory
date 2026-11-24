import type { NavItem } from "#/core/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/billing", label: "Billing", when: "signed-in" },
];
