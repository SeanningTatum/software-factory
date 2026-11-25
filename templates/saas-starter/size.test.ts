import { describe, expect, it } from "vitest";
import { firstLoadBytes, markdownTable, routePreloads, unbudgeted } from "./size";

const manifest = `routes: {
	__root__: {
		filePath: "/r.tsx",
		preloads: ["/assets/a.js", "/assets/b.js"]
	},
	"/": {
		filePath: "/i.tsx",
		children: void 0,
		preloads: ["/assets/b.js", "/assets/c.js"]
	},
	"/bare": {
		filePath: "/bare.tsx",
		children: void 0
	},
	"/last": {
		filePath: "/last.tsx",
		preloads: ["/assets/d.js"]
	}
}`;

describe("size", () => {
  it("reads a route's preloads and stops at the end of its block", () => {
    expect(routePreloads(manifest, "/")).toEqual(["/assets/b.js", "/assets/c.js"]);
    expect(routePreloads(manifest, "/bare")).toEqual([]);
    expect(routePreloads(manifest, "/last")).toEqual(["/assets/d.js"]);
    expect(routePreloads(manifest, "/login")).toBeUndefined();
  });

  it("counts each shared file once and skips a route the build lacks", () => {
    const size = (path: string) => path.length;
    expect(firstLoadBytes(manifest, "/", size)).toBe(3 * "/assets/a.js".length);
    expect(firstLoadBytes(manifest, "/login", size)).toBeUndefined();
  });

  it("names each route the budgets file leaves out", () => {
    const budget = { budget: 1, now: 1 };
    expect(unbudgeted(manifest, { routes: { "/": budget }, worker: budget })).toEqual([
      "/bare",
      "/last",
    ]);
  });

  it("writes a markdown row per measure and marks the ones over budget", () => {
    expect(
      markdownTable([
        ["/", 1024, 2048],
        ["Worker", 3072, 2048],
      ]).split("\n"),
    ).toEqual([
      "| What | Size (gzip) | Budget | |",
      "| --- | ---: | ---: | --- |",
      "| / | 1.0 kB | 2.0 kB | ok |",
      "| Worker | 3.0 kB | 2.0 kB | over |",
    ]);
  });
});
