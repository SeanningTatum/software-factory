import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The template and harness shipped next to the built CLI (dist/../template). */
const shipped = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

/**
 * The template to copy. `CF_SAAS_TEMPLATE_DIR` overrides it for `scripts/try.ts`, which points it
 * at a copy wired to local packages; it is not a user option, so --help doesn't list it.
 */
export const templateDir = () => {
  const dir = process.env.CF_SAAS_TEMPLATE_DIR || shipped("template");
  if (!existsSync(dir))
    throw new Error(`Template not found at ${dir}. Run \`bun run bundle\` first.`);
  return dir;
};

export const harnessDir = () => shipped("harness");
