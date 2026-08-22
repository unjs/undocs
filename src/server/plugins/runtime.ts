import type { UndocsPluginContext, UndocsServerPlugin } from "./types.ts";
import { loadServerPlugins } from "./resolve.ts";
import { pluginContext } from "./apply.ts";

export interface PluginRuntime {
  plugins: UndocsServerPlugin[];
  ctx: UndocsPluginContext;
}

const cache = new Map<string, Promise<PluginRuntime>>();

export function getPluginRuntime(
  docsDir: string,
  docs: Record<string, any>,
): Promise<PluginRuntime> {
  const key = docsDir;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const plugins = await loadServerPlugins(docsDir, docs);
        return { plugins, ctx: pluginContext(docsDir, docs) };
      })(),
    );
  }
  return cache.get(key)!;
}

/** Test-only reset. */
export function resetPluginRuntimeCache(): void {
  cache.clear();
}
