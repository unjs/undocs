import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "c12";

// Node-only (`node:fs`/c12); clients receive the serialized virtual module.

export async function loadDocsConfig(docsDir: string): Promise<Record<string, any>> {
  const { config } = await loadConfig<any>({ name: "docs", cwd: docsDir });

  // Infer omitted site metadata from package manifests.
  if (!config.name || !config.description) {
    const pkg = await inferFromPackage(docsDir, [
      ...(config.name ? [] : (["name"] as const)),
      ...(config.description ? [] : (["description"] as const)),
    ]);
    config.name = config.name || pkg.name || "";
    config.description = config.description || pkg.description || "";
  }

  return config;
}

/**
 * Resolve fields independently from their nearest manifest, stopping at `.git`
 * so unrelated machine ancestors cannot supply metadata.
 */
async function inferFromPackage(
  dir: string,
  fields: readonly ("name" | "description")[],
): Promise<{ name?: string; description?: string }> {
  const found: { name?: string; description?: string } = {};
  let missing = [...fields];
  let current = resolve(dir);
  while (missing.length > 0) {
    const pkg = await readJSON(join(current, "package.json"));
    missing = missing.filter((field) => {
      const value = pkg?.[field];
      if (typeof value !== "string" || !value) {
        return true;
      }
      found[field] = value;
      return false;
    });
    // `.git` may be a directory or a worktree/submodule file.
    const isRepoRoot = await readFile(join(current, ".git"))
      .then(() => true)
      .catch((error: any) => error?.code === "EISDIR");
    const parent = dirname(current);
    if (isRepoRoot || parent === current) {
      break;
    }
    current = parent;
  }
  return found;
}

async function readJSON(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}
