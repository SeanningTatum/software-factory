import { defineConfig } from "drizzle-kit";

/** Every block keeps its tables in its own schema.ts; migrations are one shared sequence. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/blocks/*/schema.ts",
  out: "./drizzle",
});
