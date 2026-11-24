import { featureNav } from "#/gen/nav.ts";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Show only to signed-in or signed-out visitors; omit to always show. */
  readonly when?: "signed-in" | "signed-out";
}

/** Every feature's `nav.ts` entries, in feature order. */
export const navItems: ReadonlyArray<NavItem> = featureNav;

export const visibleNav = (items: ReadonlyArray<NavItem>, signedIn: boolean) =>
  items.filter((item) => !item.when || (item.when === "signed-in") === signedIn);
