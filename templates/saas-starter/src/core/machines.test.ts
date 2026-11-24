import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { checkMachine, toMermaid } from "@tanstack-cf-saas/lint/machines";
import { describe, expect, it } from "vitest";
import type { AnyStateMachine } from "xstate";

/**
 * The machine gate: every `*.machine.ts` in core and the enabled blocks must be well formed.
 * `bun run machines:print` also writes each one as a Mermaid diagram into docs/machines.
 */
const modules = import.meta.glob<Record<string, unknown>>("/src/**/*.machine.ts", { eager: true });

const isMachine = (value: unknown): value is AnyStateMachine =>
  typeof value === "object" && value !== null && "root" in value && "transition" in value;

const machines = Object.entries(modules).flatMap(([path, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => isMachine(value))
    .map(([name, machine]) => ({ path, name, machine: machine as AnyStateMachine })),
);

const printTo = process.env.PRINT_MACHINES;

describe("state machines", () => {
  it("finds the machines", () => {
    expect(machines.length).toBeGreaterThan(0);
  });

  it.each(machines.map((m) => [`${m.path} ${m.name}`, m] as const))(
    "%s is well formed",
    (_, { machine }) => {
      expect(checkMachine(machine)).toEqual([]);
    },
  );

  it.runIf(printTo)("prints Mermaid diagrams", () => {
    const dir = printTo as string;
    mkdirSync(dir, { recursive: true });
    for (const { path, machine } of machines) {
      const file = join(dir, `${basename(path, ".machine.ts")}.md`);
      writeFileSync(
        file,
        `# ${machine.id}\n\nSource: \`${path.slice(1)}\`\n\n\`\`\`mermaid\n${toMermaid(machine)}\n\`\`\`\n`,
      );
    }
  });
});
