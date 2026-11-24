import { blockNav } from "#/gen/nav.ts";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Show only to signed-in or signed-out visitors; omit to always show. */
  readonly when?: "signed-in" | "signed-out";
}

export const coreNav: ReadonlyArray<NavItem> = [
  { to: "/", label: "Home" },
  { to: "/docs", label: "Docs" },
];

export const navItems: ReadonlyArray<NavItem> = [...coreNav, ...blockNav];

export const visibleNav = (items: ReadonlyArray<NavItem>, signedIn: boolean) =>
  items.filter((item) => !item.when || (item.when === "signed-in") === signedIn);
