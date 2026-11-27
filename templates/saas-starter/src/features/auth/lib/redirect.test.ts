import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { afterSignIn, RedirectSearch, toVerify } from "./redirect.ts";

const root = createRootRoute();
const page = (path: string) => createRoute({ getParentRoute: () => root, path });
const router = createRouter({
  routeTree: root.addChildren([page("/billing"), page("/dashboard"), page("/login")]),
  history: createMemoryHistory({ initialEntries: ["/login"] }),
});

const validate = (redirect: string) =>
  RedirectSearch["~standard"].validate({ redirect }) as { issues?: unknown };

describe("afterSignIn", () => {
  it("goes back to a page with its search params", () => {
    const location = router.buildLocation(afterSignIn("/billing?checkout=success") as never);
    expect(router.matchRoutes(location).map((m) => m.routeId)).toContain("/billing");
    expect(location.search).toEqual({ checkout: "success" });
  });

  it("goes to the dashboard by default", () => {
    expect(router.buildLocation(afterSignIn(undefined) as never).pathname).toBe("/dashboard");
  });
});

describe("RedirectSearch", () => {
  it("accepts a local path", () => expect(validate("/billing?x=1").issues).toBeUndefined());
  it.each(["//evil.com", "/\\evil.com", "https://evil.com"])("refuses %s", (value) =>
    expect(validate(value).issues).toBeDefined(),
  );
});

describe("toVerify", () => {
  it("carries the email in history state and keeps it out of the URL", () => {
    const target = toVerify("/verify-email", "a+b@c.dev");
    expect(target).toEqual({ href: "/verify-email", state: { unverifiedEmail: "a+b@c.dev" } });
  });
});
