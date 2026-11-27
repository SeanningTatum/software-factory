import { describe, expect, test } from "bun:test";
import { checkMachine } from "@seanningtatum/software-factory-lint/machines";
import { createActor, fromPromise, waitFor } from "xstate";
import { type CreatePlan, createMachine } from "./create.machine.ts";

const plan: CreatePlan = {
  name: "a",
  targetDir: "/tmp/a",
  features: [],
  claude: true,
  husky: true,
  github: true,
  install: true,
  git: true,
};

const run = async (overrides: Partial<CreatePlan>, scaffolded: Array<string>, failAt?: string) => {
  const steps: Array<string> = [];
  const step = (name: string) =>
    fromPromise<void, CreatePlan>(async () => {
      steps.push(name);
      if (name === failAt) throw new Error(`${name} broke`);
    });
  const actor = createActor(
    createMachine.provide({
      actors: {
        scaffold: fromPromise(async (): Promise<ReadonlyArray<string>> => {
          steps.push("scaffold");
          return scaffolded;
        }),
        install: step("install"),
        migrate: step("migrate"),
        git: step("git"),
      },
    }),
    { input: { ...plan, ...overrides } },
  ).start();
  actor.send({ type: "START" });
  const snapshot = await waitFor(actor, (s) => s.status === "done");
  return { steps, state: snapshot.value, error: snapshot.context.error };
};

describe("create machine", () => {
  test("is well formed", () => expect(checkMachine(createMachine)).toEqual([]));

  test("runs every step for a project with a database", async () => {
    expect(await run({}, ["db"])).toMatchObject({
      steps: ["scaffold", "install", "migrate", "git"],
      state: "done",
    });
  });

  test("skips migrations without a database and installs when turned off", async () => {
    expect((await run({}, [])).steps).toEqual(["scaffold", "install", "git"]);
    expect((await run({ install: false, git: false }, ["db"])).steps).toEqual(["scaffold"]);
  });

  test("stops at the first failing step", async () => {
    expect(await run({}, ["db"], "install")).toMatchObject({
      steps: ["scaffold", "install"],
      state: "failed",
    });
  });
});
