import { describe, expect, it } from "vitest";
import { firstLoadBytes, routePreloads } from "./size";

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
});
