import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkMachine, type MachineDoc, withMachines } from "@tanstack-cf-saas/lint/machines";
import { describe, expect, it } from "vitest";
import type { AnyStateMachine } from "xstate";

const modules = import.meta.glob<Record<string, unknown>>("/src/**/*.machine.ts", { eager: true });

const isMachine = (value: unknown): value is AnyStateMachine =>
  typeof value === "object" && value !== null && "root" in value && "transition" in value;

const machines = Object.entries(modules).flatMap(([path, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => isMachine(value))
    .map(([name, machine]) => ({ path, name, machine: machine as AnyStateMachine })),
);

const FEATURES = "src/features";
const CORE = "src/features/core";
const print = process.env.PRINT_MACHINES === "1";

const withTimeline = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .map((name) => `${dir}/${name}`)
        .filter((folder) => existsSync(join(folder, "TIMELINE.md")))
    : [];
const features = [...withTimeline(CORE), ...withTimeline(FEATURES)];

const docsOf = (folder: string): ReadonlyArray<MachineDoc> =>
  machines
    .filter((m) => m.path.startsWith(`/${folder}/`))
    .map((m) => ({ source: m.path.slice(1), machine: m.machine }));

describe("state machines", () => {
  it("finds the machines", () => {
    expect(machines.length).toBeGreaterThan(0);
  });

  it("every *.machine.ts exports its machine", () => {
    // One built inside an exported function is never seen here, so nothing below would check it.
    const found = new Set(machines.map((m) => m.path));
    expect(Object.keys(modules).filter((path) => !found.has(path))).toEqual([]);
  });

  it.each(machines.map((m) => [`${m.path} ${m.name}`, m] as const))(
    "%s is well formed",
    (_, { machine }) => {
      expect(checkMachine(machine)).toEqual([]);
    },
  );

  it.each(features)("%s/TIMELINE.md has current machine diagrams", (folder) => {
    const path = join(folder, "TIMELINE.md");
    const current = readFileSync(path, "utf8");
    const wanted = withMachines(current, docsOf(folder));
    if (print && wanted !== current) writeFileSync(path, wanted);
    expect(
      print || wanted === current,
      `${path} has stale machine diagrams; run \`bun run machines:print\``,
    ).toBe(true);
  });
});
