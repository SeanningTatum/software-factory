import { describe, expect, it } from "vitest";
import { type NavItem, visibleNav } from "./nav.ts";

const items: ReadonlyArray<NavItem> = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard", when: "signed-in" },
  { to: "/login", label: "Sign in", when: "signed-out" },
];

describe("visibleNav", () => {
  it("shows signed-in entries to signed-in visitors", () => {
    expect(visibleNav(items, true).map((i) => i.to)).toEqual(["/", "/dashboard"]);
  });
  it("shows signed-out entries to everyone else", () => {
    expect(visibleNav(items, false).map((i) => i.to)).toEqual(["/", "/login"]);
  });
});
