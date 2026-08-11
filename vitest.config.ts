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
      // `useAppConfig` imports the build-time vfs the `undocs:app-config` Vite
      // plugin provides; tests get a fixed stand-in so app modules that read the
      // app config (e.g. `@app/webmcp/tools`) are importable outside a build.
      "virtual:undocs/app-config": r("./test/stubs/app-config.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
