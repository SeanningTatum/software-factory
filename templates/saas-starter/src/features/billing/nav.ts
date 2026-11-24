import type { NavItem } from "#/app/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/billing", label: "Billing", when: "signed-in" },
];
