import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Mirror the `@app`/`@server` aliases from vite.config.ts so server code
  // pulled into tests (e.g. builder → `@app/utils/search`) resolves.
  resolve: {
    alias: {
      "@app": r("./src/app"),
      "@server": r("./src/server"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
