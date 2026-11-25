/**
 * Size budgets: run after `vite build`, reads `dist/` only.
 * Fails when a page's first-load JS or the Worker goes over its budget in `size-budgets.json`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** Both in gzipped kB. `now` is the size when the budget was set; nothing reads it. */
export type Budget = { budget: number; now: number };
export type Budgets = { routes: Record<string, Budget>; worker: Budget };

/** The JS paths a route's block in the built start manifest lists, or undefined if it has no block. */
export const routePreloads = (manifest: string, key: string): string[] | undefined => {
  const start = manifest.indexOf(`${key === "__root__" ? key : JSON.stringify(key)}: {`);
  if (start < 0) return undefined;
  const from = manifest.indexOf("filePath", start);
  const block = manifest.slice(from, manifest.indexOf("filePath", from + 1) + 1 || undefined);
  const list = /preloads: \[([^\]]*)\]/.exec(block)?.[1] ?? "";
  return [...list.matchAll(/"([^"]+\.js)"/g)].map((m) => m[1] as string);
};

const gzipped = (file: string) => gzipSync(readFileSync(file)).length;

/** Gzipped bytes of every distinct file a first load of the route fetches (root files too). */
export const firstLoadBytes = (
  manifest: string,
  key: string,
  size: (path: string) => number,
): number | undefined => {
  const own = routePreloads(manifest, key);
  if (!own) return undefined;
  const files = new Set([...(routePreloads(manifest, "__root__") ?? []), ...own]);
  return [...files].reduce((sum, file) => sum + size(file), 0);
};

const jsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? jsFiles(path) : name.endsWith(".js") ? [path] : [];
  });

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;

const main = () => {
  const budgets = JSON.parse(readFileSync("size-budgets.json", "utf8")) as Budgets;
  const assets = "dist/server/assets";
  const manifestName = existsSync(assets)
    ? readdirSync(assets).find((f) => f.startsWith("_tanstack-start-manifest"))
    : undefined;
  if (!manifestName) {
    process.stderr.write("size: no build in dist/. Run `bun run build` first.\n");
    process.exitCode = 1;
    return;
  }
  const manifest = readFileSync(join(assets, manifestName), "utf8");
  // Without this, a change in the manifest's format would skip every route and pass.
  if (!routePreloads(manifest, "__root__")?.length) {
    process.stderr.write(`size: found no root preloads in ${manifestName}; update size.ts.\n`);
    process.exitCode = 1;
    return;
  }
  const rows: [string, number, number][] = [];
  for (const [route, { budget }] of Object.entries(budgets.routes)) {
    const bytes = firstLoadBytes(manifest, route, (path) => gzipped(join("dist/client", path)));
    if (bytes === undefined) process.stdout.write(`size: ${route} is not in this build, skipped\n`);
    else rows.push([`${route} (client JS)`, bytes, budget * 1024]);
  }
  const worker = jsFiles("dist/server").reduce((sum, file) => sum + gzipped(file), 0);
  rows.push(["Worker (gzip)", worker, budgets.worker.budget * 1024]);

  process.stdout.write(`${"what".padEnd(22)}${"size".padStart(11)}${"budget".padStart(11)}\n`);
  for (const [name, bytes, budget] of rows) {
    const over = bytes > budget ? "  OVER" : "";
    process.stdout.write(
      `${name.padEnd(22)}${kb(bytes).padStart(11)}${kb(budget).padStart(11)}${over}\n`,
    );
  }
  const over = rows.filter(([, bytes, budget]) => bytes > budget);
  if (over.length > 0) {
    process.stderr.write(
      `size: ${over.map(([name]) => name).join(", ")} over budget. Cut the weight, or raise the budget in size-budgets.json and say why.\n`,
    );
    process.exitCode = 1;
  }
};

if (import.meta.main) main();
