import type { NavItem } from "#/app/nav.ts";

export const nav: ReadonlyArray<NavItem> = [
  { to: "/forgot-password", label: "Forgot password?", when: "sign-in-help" },
  { to: "/sign-in-code", label: "Email me a sign-in code", when: "sign-in-help" },
  { to: "/verify-email", label: "Verify your email", when: "verify-email" },
];
