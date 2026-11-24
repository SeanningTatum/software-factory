import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { routePath, scanFeature } from "./scan.ts";

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-scan-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

describe("routePath", () => {
  test("turns file routes into URL paths", () => {
    expect(routePath("index.tsx")).toBe("/");
    expect(routePath("login.tsx")).toBe("/login");
    expect(routePath("api/uploads/index.ts")).toBe("/api/uploads");
    expect(routePath("api/uploads/$id.ts")).toBe("/api/uploads/$id");
    expect(routePath("api/auth/$.ts")).toBe("/api/auth/$");
    expect(routePath("posts.$id.edit.tsx")).toBe("/posts/$id/edit");
    expect(routePath("(app)/_layout/settings.tsx")).toBe("/settings");
    expect(routePath("posts_/$id.tsx")).toBe("/posts/$id");
  });

  test("skips tests, ignored files and pathless layouts", () => {
    expect(routePath("login.test.ts")).toBeUndefined();
    expect(routePath("-components/x.tsx")).toBeUndefined();
    expect(routePath("_layout.tsx")).toBeUndefined();
    expect(routePath("notes.md")).toBeUndefined();
  });
});

describe("scanFeature", () => {
  test("reads services, errors, events, routes and machines from the text", () => {
    const root = project({
      "src/features/uploads/api/uploads.ts": [
        'export class UploadRejected extends Schema.TaggedError<UploadRejected>()("UploadRejected", {}) {}',
        "export class StorageError extends Schema.TaggedError<StorageError>()(",
        "export class Uploads extends Context.Service<",
        "class Hidden extends Context.Service<",
      ].join("\n"),
      "src/features/uploads/api/uploads.test.ts": "export class Fake extends Context.Service<",
      "src/features/uploads/events.ts": 'const A = Schema.TaggedStruct("file_uploaded", {});',
      "src/features/uploads/routes/uploads.tsx": "",
      "src/features/uploads/routes/api/uploads/$id.ts": "",
      "src/features/uploads/components/upload.machine.ts": "",
      "src/features/uploads/components/upload.machine.test.ts": "",
    });
    expect(scanFeature(root, "src/features/uploads")).toEqual({
      routes: ["/api/uploads/$id", "/uploads"],
      services: ["Uploads"],
      errors: ["StorageError", "UploadRejected"],
      events: ["file_uploaded"],
      machines: ["components/upload.machine.ts"],
    });
  });

  test("a bare feature has nothing", () => {
    const root = project({ "src/features/core/ui/feature.json": "{}" });
    expect(scanFeature(root, "src/features/core/ui")).toEqual({
      routes: [],
      services: [],
      errors: [],
      events: [],
      machines: [],
    });
  });
});
