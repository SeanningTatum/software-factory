import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

export const PROJECT_FILE = "cf-saas.json";

export const ProjectConfig = Schema.Struct({
  $schema: Schema.optionalKey(Schema.String),
  name: Schema.String,
  template: Schema.String,
  managed: Schema.Struct({
    bindings: Schema.Array(Schema.String),
    vars: Schema.Array(Schema.String),
  }),
});
export type ProjectConfig = typeof ProjectConfig.Type;

const decode = Schema.decodeUnknownSync(ProjectConfig);

export const readProject = (root: string): ProjectConfig => {
  const path = join(root, PROJECT_FILE);
  if (!existsSync(path)) {
    throw new Error(`${PROJECT_FILE} not found in ${root}. Is this a tanstack-cf-saas project?`);
  }
  return decode(JSON.parse(readFileSync(path, "utf8")));
};

export const projectText = (config: ProjectConfig) => `${JSON.stringify(config, null, 2)}\n`;

export const writeProject = (root: string, config: ProjectConfig) =>
  writeFileSync(join(root, PROJECT_FILE), projectText(config));
