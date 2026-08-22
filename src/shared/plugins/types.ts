/** Docs config entry: package name or `{ package, options }`. */
export type PluginSpec = string | { package: string; options?: Record<string, unknown> };

export interface ResolvedPluginSpec {
  /** Import specifier (package name or absolute path). */
  id: string;
  options: Record<string, unknown>;
}

/** Path role for content routing (blog listing, surround order, …). */
export type PathClassification = "blog" | "blog-index" | "home" | "docs";

export function normalizePluginSpecs(plugins?: PluginSpec[]): ResolvedPluginSpec[] {
  if (!plugins?.length) return [];
  return plugins.map((entry) => {
    if (typeof entry === "string") return { id: entry, options: {} };
    return { id: entry.package, options: entry.options ?? {} };
  });
}
