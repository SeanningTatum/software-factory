import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const workflows = join(repo, "claude/workflows");
const names = readdirSync(workflows)
  .filter((f) => f.endsWith(".js"))
  .map((f) => basename(f, ".js"));
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);

describe.each(names)("workflow block %s", (name) => {
  const evals = join(repo, "evals", name);
  const cases: Array<{ name: string; mustCatch: unknown[] }> = existsSync(join(evals, "cases.json"))
    ? read(join(evals, "cases.json"))
    : [];
  const load = () =>
    import(join(evals, "check.js")) as Promise<{ check: (...a: unknown[]) => string[] }>;
  const caseFor = (file: string) => cases.find((c) => file.startsWith(c.name));

  test("is named after its file and has a command that runs it", () => {
    const script = readFileSync(join(workflows, `${name}.js`), "utf8");
    expect(script).toContain(`name: "${name}"`);
    const commands = list(join(repo, "claude/commands")).map((f) =>
      readFileSync(join(repo, "claude/commands", f), "utf8"),
    );
    expect(commands.some((c) => c.includes(`\`${name}\``))).toBe(true);
  });

  test("has no comments in its script or its checks, unless the file opens by allowing them", () => {
    for (const file of [join(workflows, `${name}.js`), join(evals, "check.js")]) {
      const text = readFileSync(file, "utf8");
      const allowed = text.startsWith("// software-factory-lint allow comments\n");
      expect(allowed || !/^\s*(\/\/|\/\*)/m.test(text), file).toBe(true);
    }
  });

  test("has golden cases, each with a flaw the output must catch", () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) expect(c.mustCatch.length).toBeGreaterThan(0);
  });

  test("has a saved real output for every case, and each passes its checks", async () => {
    const { check } = await load();
    for (const c of cases) {
      const golden = join(evals, "golden", `${c.name}.json`);
      expect(existsSync(golden), `no golden output for case ${c.name}`).toBe(true);
      expect(check(c, read(golden))).toEqual([]);
    }
  });

  test("has a known-bad output, and the checks refuse each one", async () => {
    const { check } = await load();
    const bad = list(join(evals, "bad"));
    expect(bad.length).toBeGreaterThan(0);
    for (const file of bad)
      expect(check(caseFor(file), read(join(evals, "bad", file))).length).toBeGreaterThan(0);
  });
});
