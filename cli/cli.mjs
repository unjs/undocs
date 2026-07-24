import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineCommand, runMain } from "citty";
import consola from "consola";

// Root of the undocs package (contains vite.config.ts / nitro.config.ts / src).
// When undocs is installed as a dependency, this points at the package dir
// inside node_modules — NOT the user's cwd — so Vite always loads OUR config.
const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const viteConfig = resolve(pkgRoot, "vite.config.ts");

/**
 * Resolve the docs dir to an absolute path and expose it to the Vite/Nitro
 * stack via `UNDOCS_DIR`. Both `nitro.config.ts` (config-time c12 load +
 * `runtimeConfig.undocs.dir`) and `src/server/routes/config.get.ts` read it,
 * so an arbitrary docs dir works with zero config duplication.
 */
function useDocsDir(dir) {
  const abs = resolve(process.cwd(), dir || ".");
  process.env.UNDOCS_DIR = abs;
  return abs;
}

export function createCLI(opts) {
  const logger = consola.withTag(opts.name || "undocs");

  const sharedArgs = {
    dir: {
      type: "positional",
      description: "Docs directory",
      required: false,
      default: ".",
    },
    port: {
      type: "string",
      description: "Port to listen on (dev)",
      required: false,
    },
    host: {
      type: "string",
      description: "Host to listen on (dev)",
      required: false,
    },
  };

  const dev = defineCommand({
    meta: { name: "dev", description: "Start docs in development mode" },
    args: { ...sharedArgs },
    async setup({ args }) {
      const docsDir = useDocsDir(args.dir);
      logger.info(`Starting dev server for \`${docsDir}\``);

      const { createServer } = await import("vite");
      const server = await createServer({
        root: pkgRoot,
        configFile: viteConfig,
        server: {
          port: Number(args.port || process.env.PORT || 3000),
          // Bare `--host` parses to "" (citty) — treat it as Vite's "expose on
          // all interfaces" (host: true), matching `vite --host`.
          host: args.host === "" ? true : args.host || process.env.HOST,
        },
      });
      await server.listen();
      server.printUrls();

      const shutdown = () => server.close().finally(() => process.exit(0));
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    },
  });

  const build = defineCommand({
    meta: { name: "build", description: "Build docs for production" },
    args: { ...sharedArgs },
    async setup({ args }) {
      const docsDir = useDocsDir(args.dir);
      logger.info(`Building docs for \`${docsDir}\``);

      // The `nitro()` vite plugin (preset: node-server) drives a
      // multi-environment build: the `client` environment emits the hashed SPA
      // assets into `.output/public`, and the `nitro` environment emits
      // `.output/server/index.mjs`. This is the `buildApp` path — the single
      // `build()` helper only builds one environment (client), so we use
      // `createBuilder().buildApp()` (what the `vite build` CLI runs).
      //
      // The output lands under the DOCS dir (`<docsDir>/.output`, or the preset's
      // equivalent) — Nitro's `rootDir` is `pkgRoot`, but the `rebaseOutput` nitro
      // module (see `src/server/rebase-output.ts`) relocates the output tree onto
      // `docsDir` so `undocs build <dir>` writes into the user's project.
      const { createBuilder } = await import("vite");
      const builder = await createBuilder({
        root: pkgRoot,
        configFile: viteConfig,
      });
      await builder.buildApp();

      const entry = resolve(docsDir, ".output/server/index.mjs");
      logger.success(`Build complete → ${docsDir}/.output (run \`node ${entry}\`)`);
    },
  });

  const main = defineCommand({
    meta: { name: opts.name, description: opts.description },
    subCommands: { dev, build },
  });

  return {
    runMain: () => runMain(main),
  };
}
