import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { envNames, setBindingField, WRANGLER_FILE } from "@tanstack-cf-saas/blocks";
import { ownRepository, teardownPlan } from "../scripts/teardown.ts";
import type { Cli } from "./github.ts";

const TEMPLATE = join(import.meta.dirname, "../../../templates/saas-starter");
const answer = (stdout: string) => ({ ok: true, stdout, stderr: "" });

describe("teardown", () => {
  /** A copy of the template as `setup` leaves it: real ids for D1 and KV in both environments. */
  const provisioned = () => {
    const dir = mkdtempSync(join(tmpdir(), "teardown-"));
    rmSync(dir, { recursive: true });
    cpSync(TEMPLATE, dir, {
      recursive: true,
      filter: (src) => !/node_modules|\.wrangler|\/dist/.test(src),
    });
    const path = join(dir, WRANGLER_FILE);
    const text = envNames.reduce(
      (acc, env) =>
        setBindingField(
          setBindingField(acc, env, "d1_databases", "DB", "database_id", `d1-${env}`),
          env,
          "kv_namespaces",
          "KV",
          "id",
          `kv-${env}`,
        ),
      readFileSync(path, "utf8"),
    );
    writeFileSync(path, text);
    return dir;
  };

  test("deletes both Workers first, then what setup recorded, then the repository", () => {
    const plan = teardownPlan(provisioned(), "someone/my-app");
    const args = plan.map((s) => s.args.join(" "));
    expect(args.slice(0, 2)).toEqual([
      "delete saas-starter --force",
      "delete saas-starter-staging --force",
    ]);
    // Each environment's database is named with its own --env, so wrangler reads the right id.
    expect(args.filter((a) => a.startsWith("d1"))).toEqual([
      "d1 delete saas-starter-db -y",
      "d1 delete saas-starter-db-staging -y --env staging",
    ]);
    expect(args.filter((a) => a.startsWith("kv"))).toEqual([
      "kv namespace delete --namespace-id kv-production -y",
      "kv namespace delete --namespace-id kv-staging -y",
    ]);
    expect(args.filter((a) => a.startsWith("r2"))).toHaveLength(2);
    expect(args.filter((a) => a.startsWith("workflows"))).toEqual([
      "workflows delete saas-starter-onboarding",
      "workflows delete saas-starter-onboarding-staging",
    ]);
    expect(args.at(-1)).toBe("repo delete someone/my-app --yes");
  });

  test("leaves alone what setup never made: a placeholder id is not a database", () => {
    const plan = teardownPlan(TEMPLATE, undefined);
    expect(plan.some((s) => s.args[0] === "d1" || s.args[0] === "kv")).toBe(false);
    expect(plan.some((s) => s.tool === "gh")).toBe(false);
  });

  test("never names a repository the folder does not own", () => {
    const git =
      (top: string): Cli =>
      (args) =>
        answer(args[0] === "rev-parse" ? top : "git@github.com:someone/my-app.git\n");
    expect(ownRepository(TEMPLATE, git(`${TEMPLATE}\n`))).toBe("someone/my-app");
    // A folder inside another checkout sees that checkout's origin: deleting it would be a disaster.
    expect(ownRepository(TEMPLATE, git(join(TEMPLATE, "../..")))).toBeUndefined();
  });
});
