import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildIndex } from "./builder.ts";
import type { ContentIndex } from "./types.ts";
import { useRuntimeConfig } from "nitro/runtime-config";

let cache: Promise<ContentIndex> | undefined;

// TEMPORARY: fall back from a missing baked build-machine path to bundled docs,
// resolved against Nitro's entry so relocated output still works.
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
    const docs = (config.undocs || {}) as {
      dir?: string;
      automd?: unknown;
      i18n?: { localeCodes?: string[]; defaultLocale?: string };
    };
    const dir = resolveDir(docs.dir);
    cache = buildIndex({
      dir,
      automd: docs.automd,
      localeCodes: docs.i18n?.localeCodes,
      defaultLocale: docs.i18n?.defaultLocale,
    });
  }
  return cache;
}

export function getDocsDir(): string {
  const config = useRuntimeConfig();
  const docs = (config.undocs || {}) as { dir?: string };
  return resolveDir(docs.dir);
}

export function invalidateIndex() {
  cache = undefined;
}
