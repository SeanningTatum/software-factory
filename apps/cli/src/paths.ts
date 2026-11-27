import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The template, harness and commit hooks shipped next to the built CLI (dist/../template). */
const shipped = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

/**
 * The template to copy. `SOFTWARE_FACTORY_TEMPLATE_DIR` overrides it for `scripts/try.ts`, which points it
 * at a copy wired to local packages; it is not a user option, so --help doesn't list it.
 */
export const templateDir = () => {
  const dir = process.env.SOFTWARE_FACTORY_TEMPLATE_DIR || shipped("template");
  if (!existsSync(dir))
    throw new Error(`Template not found at ${dir}. Run \`bun run bundle\` first.`);
  return dir;
};

export const harnessDir = () => shipped("harness");
export const huskyDir = () => shipped("husky");
