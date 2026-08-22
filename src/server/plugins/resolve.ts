import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
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

/** Load server plugins declared in `docs.plugins`. */
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
    plugins.push({
      ...bundle.server,
      name: bundle.server.name || spec.id,
      options: spec.options ?? {},
    });
  }
  return plugins;
}

/** Client import specifiers for the Vite virtual module (static graph). */
/** Normalized plugin specs for the client virtual module. */
export function resolveClientPluginSpecifiers(
  docsDir: string,
  docs: Record<string, any>,
): ResolvedPluginSpec[] {
  return normalizePluginSpecs(docs.plugins as PluginSpec[] | undefined);
}

function localClientCandidates(base: string): string[] {
  const isFilePath = base.endsWith(".ts") || base.endsWith(".js");
  const candidates = [
    `${base}/client.ts`,
    `${base}/client.js`,
    `${base}/client`,
    `${base}/client/index.ts`,
    `${base}/client/index.js`,
  ];
  if (isFilePath) {
    candidates.push(base);
  } else {
    candidates.push(`${base}/index.ts`, `${base}/index.js`);
  }
  return candidates;
}

/** Resolve a local path to an importable file (handles extensionless `client/` dirs). */
function resolveExistingClientFile(candidate: string): string | null {
  if (!existsSync(candidate)) return null;
  const st = statSync(candidate);
  if (st.isFile()) return candidate;
  if (st.isDirectory()) {
    for (const index of ["index.ts", "index.js"]) {
      const entry = join(candidate, index);
      if (existsSync(entry)) return entry;
    }
  }
  return null;
}

/** Pick the client plugin export from a namespace import. */
export function pickClientPluginExport(mod: Record<string, unknown>): unknown {
  const d = mod.default as Record<string, unknown> | undefined;
  return d?.client ?? mod.client ?? d ?? mod;
}

/** Resolve a client entry path, or `null` when none exists on disk. */
export function resolveClientPluginImport(
  spec: ResolvedPluginSpec,
  docsDir: string,
): string | null {
  const id = spec.id;
  if (id.startsWith(".") || isAbsolute(id)) {
    const base = resolve(docsDir, id);
    for (const candidate of localClientCandidates(base)) {
      const entry = resolveExistingClientFile(candidate);
      if (entry) return entry;
    }
    return null;
  }
  const req = createRequire(resolve(docsDir, "package.json"));
  for (const suffix of ["/client", ""]) {
    try {
      return req.resolve(`${id}${suffix}`);
    } catch {
      // try next
    }
  }
  return null;
}
