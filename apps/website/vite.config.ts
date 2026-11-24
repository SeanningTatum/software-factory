import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Its own inspector port, so it can run beside the template (`bun run dev` at the repo root).
    cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: 9239 }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.test\\.tsx?$",
        virtualRouteConfig: "./src/gen/routes.ts",
      },
    }),
    viteReact(),
  ],
});
