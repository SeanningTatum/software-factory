import { defineConfig } from "drizzle-kit";

/**
 * Every feature and core module keeps its tables in its own schema.ts; migrations are one shared
 * sequence.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/features/*/schema.ts", "./src/features/core/*/schema.ts"],
  out: "./drizzle",
});
