// Tests: test/content/store.test.ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildIndex } from "./builder";
import type { ContentIndex } from "./types";
import { useRuntimeConfig } from "nitro/runtime-config";

let cache: Promise<ContentIndex> | undefined;

// TEMPORARY: on a prod deploy the baked `runtimeConfig.undocs.dir` is an absolute
// build-machine path that no longer exists. The `bundle-docs` Nitro module copies
// the docs into `<output>/server/docs`; resolve that fallback relative to the
// Nitro entry (`globalThis.__nitro_main__`, set on line 1 of `index.mjs`) so it
// works regardless of where `.output` is deployed. See `src/server/bundle-docs.ts`.
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

export function getIndex(): Promise<ContentIndex> {
  if (!cache) {
    const config = useRuntimeConfig();
    const docs = (config.undocs || {}) as { dir?: string; automd?: unknown };
    const dir = resolveDir(docs.dir);
    cache = buildIndex({ dir, automd: docs.automd });
  }
  return cache;
}

/**
 * Resolve the on-disk docs directory (bundled-deploy aware — see `resolveDir`).
 * Used by routes that read source files directly, e.g. the raw `.md` route.
 */
export function getDocsDir(): string {
  const config = useRuntimeConfig();
  const docs = (config.undocs || {}) as { dir?: string };
  return resolveDir(docs.dir);
}

export function invalidateIndex() {
  cache = undefined;
}
