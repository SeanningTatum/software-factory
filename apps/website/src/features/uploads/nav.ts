import type { NavItem } from "#/app/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/uploads", label: "Uploads", when: "signed-in" },
];
