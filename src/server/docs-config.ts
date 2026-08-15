import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "c12";

/**
 * Load the docs project config (`<docsDir>/.config/docs.*`) via c12.
 *
 * Both config-time consumers go through here — `nitro.config.ts` (which mirrors
 * parts of it into `runtimeConfig.undocs`) and `app-config.ts` (which builds the
 * client `virtual:undocs/app-config`) — so an inferred value cannot exist on one
 * side and be missing on the other.
 *
 * Node-only (fs + c12): keep it under `src/server/`.
 */
export async function loadDocsConfig(docsDir: string): Promise<Record<string, any>> {
  const { config } = await loadConfig<any>({ name: "docs", cwd: docsDir });

  // `name` (header, `<title>`, OG cards) and `description` (meta description,
  // OG cards, llms.txt) both restate what the package already declares, so infer
  // them from the closest `package.json` rather than making every docs project
  // repeat them.
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
 * Walk up from `dir` collecting `fields` from the closest `package.json`.
 *
 * Each field resolves independently against the FIRST ancestor that declares it,
 * so a workspace package with a `name` but no `description` still inherits the
 * monorepo root's `description` instead of falling back to nothing. The walk
 * stops at the repo root — the first directory holding `.git` is the last one
 * checked, so a docs project outside any package cannot borrow values from some
 * unrelated ancestor on the machine.
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
    // `.git` is a directory in a normal clone and a file in a worktree/submodule;
    // `readFile` on the directory rejects, which is the signal either way.
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
