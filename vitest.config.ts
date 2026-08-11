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
      // Same deal for the user-pages vfs, which `router.ts` and `webmcp/tools/`
      // (its "is this a real route?" check) both read.
      "virtual:undocs/user-pages": r("./test/stubs/user-pages.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
