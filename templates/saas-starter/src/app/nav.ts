// software-factory-lint allow comments
import { featureNav } from "#/gen/nav.ts";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  /** `sign-in-help` links sit under the sign-in form; `verify-email` is where an unverified user goes. */
  readonly when?: "signed-in" | "signed-out" | "sign-in-help" | "verify-email";
}

export const navItems: ReadonlyArray<NavItem> = featureNav;

export const visibleNav = (items: ReadonlyArray<NavItem>, signedIn: boolean) =>
  items.filter((item) => !item.when || item.when === (signedIn ? "signed-in" : "signed-out"));

export const navFor = (when: NonNullable<NavItem["when"]>) =>
  navItems.filter((item) => item.when === when);
