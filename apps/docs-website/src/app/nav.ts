import { featureNav } from "#/gen/nav.ts";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly when?: "signed-in" | "signed-out";
}

export const navItems: ReadonlyArray<NavItem> = featureNav;
