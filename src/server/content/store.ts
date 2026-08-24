import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildIndex } from "./builder.ts";
import type { ContentIndex } from "./types.ts";
import { useRuntimeConfig } from "nitro/runtime-config";
import { loadDocsConfig } from "../docs-config.ts";
import { getPluginRuntime } from "../plugins/runtime.ts";
import { applyBuildOptionsPlugins } from "../plugins/apply.ts";

let cache: Promise<ContentIndex> | undefined;

/**
 * Resolve the on-disk docs dir. Falls back from a missing baked build-machine
 * path to bundled docs under Nitro's entry so relocated output still works.
 */
function resolveDir(configuredDir?: string): string {
  if (configuredDir && existsSync(configuredDir)) {
    return configuredDir;
  }
  const main = (globalThis as any).__nitro_main__ as string | undefined;
  if (main) {
    const bundled = fileURLToPath(new URL("./docs", main));
    if (existsSync(bundled)) {
      return bundled;
    }
  }
  if (configuredDir) {
    return configuredDir;
  }
  throw new Error("[undocs] content dir is not configured (runtimeConfig.undocs.dir)");
}

/** Build (or return the cached) content index, applying plugin `buildOptions` first. */
export function getIndex(): Promise<ContentIndex> {
  if (!cache) {
    const config = useRuntimeConfig();
    const docs = (config.undocs || {}) as { dir?: string; automd?: unknown };
    const dir = resolveDir(docs.dir);
    cache = (async () => {
      const docsConfig = await loadDocsConfig(dir);
      const pluginRuntime = await getPluginRuntime(dir, docsConfig);
      const buildOpts = applyBuildOptionsPlugins(
        { dir, automd: docs.automd, pluginRuntime },
        pluginRuntime.plugins,
        pluginRuntime.ctx,
      );
      return buildIndex(buildOpts);
    })();
  }
  return cache;
}

/** Absolute path of the configured docs directory. */
export function getDocsDir(): string {
  const config = useRuntimeConfig();
  const docs = (config.undocs || {}) as { dir?: string };
  return resolveDir(docs.dir);
}

/** Drop the memoized index so the next `getIndex()` rebuilds. */
export function invalidateIndex() {
  cache = undefined;
}
