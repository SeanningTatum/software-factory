import { describe, expect, test } from "bun:test";
import { detectPackageManager, runCommand } from "./pm.ts";

describe("package manager", () => {
  test("detects who launched the CLI", () => {
    expect(detectPackageManager("pnpm/9.0.0 npm/? node/v22")).toBe("pnpm");
    expect(detectPackageManager("npm/10.0.0 node/v22")).toBe("npm");
    expect(detectPackageManager("")).toBe("bun");
  });
  test("builds script commands", () => {
    expect(runCommand("npm", "db:generate")).toEqual(["npm", ["run", "db:generate"]]);
    expect(runCommand("npm", "db:generate", "init")).toEqual([
      "npm",
      ["run", "db:generate", "--", "init"],
    ]);
    expect(runCommand("bun", "db:generate", "init")).toEqual([
      "bun",
      ["run", "db:generate", "init"],
    ]);
  });
});
