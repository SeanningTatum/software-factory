import { defineConfig } from "drizzle-kit";

/** Every feature keeps its tables in its own schema.ts; migrations are one shared sequence. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/features/*/schema.ts",
  out: "./drizzle",
});
