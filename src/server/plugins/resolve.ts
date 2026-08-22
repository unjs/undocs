import { createRequire } from "node:module";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadDocsConfig } from "../docs-config.ts";
import {
  normalizePluginSpecs,
  type PluginSpec,
  type ResolvedPluginSpec,
} from "../../shared/plugins/types.ts";
import type { UndocsPluginBundle, UndocsServerPlugin } from "./types.ts";

const SERVER_SUFFIXES = ["/server", "/server.js", "/server.ts", ""];

function resolvePluginEntry(spec: ResolvedPluginSpec, docsDir: string, suffix: string): string {
  const id = spec.id;
  if (id.startsWith(".") || isAbsolute(id)) {
    const base = resolve(docsDir, id);
    if (suffix) return base + suffix.replace(/^\//, "/");
    return base.endsWith(".js") || base.endsWith(".ts") ? base : base;
  }
  const req = createRequire(resolve(docsDir, "package.json"));
  if (suffix) {
    try {
      return req.resolve(`${id}${suffix}`);
    } catch {
      // fall through
    }
  }
  return req.resolve(id);
}

async function importPluginModule(
  spec: ResolvedPluginSpec,
  docsDir: string,
): Promise<UndocsPluginBundle> {
  let lastError: unknown;
  for (const suffix of SERVER_SUFFIXES) {
    try {
      const entry = resolvePluginEntry(spec, docsDir, suffix);
      const mod = await import(pathToFileURL(entry).href);
      const bundle = (mod.default ?? mod) as UndocsPluginBundle | UndocsServerPlugin;
      if (
        bundle &&
        typeof bundle === "object" &&
        "name" in bundle &&
        !("server" in bundle) &&
        !("client" in bundle)
      ) {
        return { server: bundle as UndocsServerPlugin };
      }
      return bundle as UndocsPluginBundle;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`[undocs] failed to load plugin "${spec.id}"`);
}

export async function loadServerPlugins(
  docsDir: string,
  docs?: Record<string, any>,
): Promise<UndocsServerPlugin[]> {
  const config = docs ?? (await loadDocsConfig(docsDir));
  const specs = normalizePluginSpecs(config.plugins as PluginSpec[] | undefined);
  const plugins: UndocsServerPlugin[] = [];
  for (const spec of specs) {
    const bundle = await importPluginModule(spec, docsDir);
    if (!bundle.server) {
      console.warn(`[undocs] plugin "${spec.id}" has no server entry — skipped`);
      continue;
    }
    plugins.push({ ...bundle.server, name: bundle.server.name || spec.id });
  }
  return plugins;
}

/** Client import specifiers for the Vite virtual module (static graph). */
export function resolveClientPluginSpecifiers(
  docsDir: string,
  docs: Record<string, any>,
): ResolvedPluginSpec[] {
  return normalizePluginSpecs(docs.plugins as PluginSpec[] | undefined);
}

export function resolveClientPluginImport(spec: ResolvedPluginSpec, docsDir: string): string {
  const id = spec.id;
  if (id.startsWith(".") || isAbsolute(id)) {
    const base = resolve(docsDir, id);
    for (const suffix of ["/client.ts", "/client.js", "/client", ""]) {
      const candidate = suffix ? base + suffix.replace(/^\//, "/") : base;
      if (candidate.endsWith(".ts") || candidate.endsWith(".js")) return candidate;
      if (!suffix) return candidate;
    }
    return base;
  }
  const req = createRequire(resolve(docsDir, "package.json"));
  for (const suffix of ["/client", ""]) {
    try {
      return req.resolve(`${id}${suffix}`);
    } catch {
      // try next
    }
  }
  return req.resolve(id);
}
