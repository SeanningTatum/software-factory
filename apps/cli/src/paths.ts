import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The template and harness shipped next to the built CLI (dist/../template). */
const shipped = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

export const templateDir = () => {
  const dir = shipped("template");
  if (!existsSync(dir))
    throw new Error(`Template not found at ${dir}. Run \`bun run bundle\` first.`);
  return dir;
};

export const harnessDir = () => shipped("harness");
