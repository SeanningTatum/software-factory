import type { NavItem } from "#/app/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/dashboard", label: "Dashboard", when: "signed-in" },
  { to: "/login", label: "Sign in", when: "signed-out" },
  { to: "/signup", label: "Sign up", when: "signed-out" },
];
