import type { NavItem } from "#/core/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/uploads", label: "Uploads", when: "signed-in" },
];
