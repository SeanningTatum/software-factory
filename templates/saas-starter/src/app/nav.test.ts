import { describe, expect, it } from "vitest";
import { type NavItem, visibleNav } from "./nav.ts";

const items: ReadonlyArray<NavItem> = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard", when: "signed-in" },
  { to: "/login", label: "Sign in", when: "signed-out" },
  { to: "/forgot-password", label: "Forgot password?", when: "sign-in-help" },
];

describe("visibleNav", () => {
  it("never puts a sign-in-help entry in the header", () => {
    const shown = [...visibleNav(items, true), ...visibleNav(items, false)];
    expect(shown.map((i) => i.to)).not.toContain("/forgot-password");
  });
  it("shows signed-in entries to signed-in visitors", () => {
    expect(visibleNav(items, true).map((i) => i.to)).toEqual(["/", "/dashboard"]);
  });
  it("shows signed-out entries to everyone else", () => {
    expect(visibleNav(items, false).map((i) => i.to)).toEqual(["/", "/login"]);
  });
});
