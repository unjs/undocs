import type { PluginSpec } from "../../../schema/config.d.ts";

export type { PluginSpec };

export interface ResolvedPluginSpec {
  /** Import specifier (package name or absolute path). */
  id: string;
  options: Record<string, unknown>;
}

/** Path role for content routing (blog listing, surround order, …). */
export type PathClassification = "blog" | "blog-index" | "home" | "docs";

/** Normalize `docs.plugins` entries to `{ id, options }`. */
export function normalizePluginSpecs(plugins?: PluginSpec[]): ResolvedPluginSpec[] {
  if (!plugins?.length) return [];
  return plugins.map((entry) => {
    if (typeof entry === "string") return { id: entry, options: {} };
    return { id: entry.package, options: entry.options ?? {} };
  });
}
