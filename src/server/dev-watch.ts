import { watch, readdirSync, lstatSync, type FSWatcher } from "node:fs";
import { join, relative, sep } from "node:path";
import { useRuntimeConfig } from "nitro/runtime-config";
import { definePlugin as defineNitroPlugin } from "nitro";
import { invalidateIndex } from "./content/store.ts";
import { EXCLUDE } from "./content/builder.ts";
import { broadcastReload } from "./dev-reload.ts";

// Watch directories non-recursively so builder exclusions save Linux inotify
// capacity and each watcher can handle asynchronous errors without killing dev.

// Stop before a pathological tree exhausts the shared inotify budget.
const MAX_WATCHED_DIRS = 2048;

const isExcludedDir = (rel: string) => EXCLUDE.some((re) => re.test(`/${rel}/`));

// Breadth-first and exclusion-aware; do not follow symlink cycles.

export function collectWatchDirs(root: string, max = MAX_WATCHED_DIRS): string[] {
  const dirs: string[] = [root];
  const queue: Array<[abs: string, rel: string]> = [[root, ""]];
  while (queue.length > 0 && dirs.length < max) {
    const [abs, rel] = queue.shift()!;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isExcludedDir(childRel)) continue;
      dirs.push(join(abs, entry.name));
      queue.push([join(abs, entry.name), childRel]);
      if (dirs.length >= max) break;
    }
  }
  return dirs;
}

export default defineNitroPlugin((nitro) => {
  const config = useRuntimeConfig();
  const dir = (config.undocs || {}).dir as string | undefined;
  if (!dir) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      invalidateIndex();
      broadcastReload();
    }, 100);
  };

  const watchers = new Map<string, FSWatcher>();
  let capped = false;

  const relOf = (abs: string) => relative(dir, abs).split(sep).join("/");

  const watchDir = (abs: string) => {
    if (watchers.has(abs)) return;
    if (watchers.size >= MAX_WATCHED_DIRS) {
      if (!capped) {
        capped = true;
        console.warn(
          `[undocs] watching only the first ${MAX_WATCHED_DIRS} directories of ${dir}; ` +
            `edits deeper in the tree won't live-reload.`,
        );
      }
      return;
    }
    let watcher: FSWatcher;
    try {
      watcher = watch(abs, (_event, filename) => onEvent(abs, filename));
    } catch {
      return;
    }
    // Node rethrows unhandled asynchronous watcher errors.
    watcher.on("error", () => {
      watcher.close();
      watchers.delete(abs);
    });
    watchers.set(abs, watcher);
  };

  const onEvent = (abs: string, filename: string | Buffer | null) => {
    if (!filename) return;
    const name = String(filename);
    if (name.endsWith(".md") || name.endsWith(".yml")) {
      schedule();
      return;
    }
    // A moved-in directory must be watched before its own file events can arrive.
    const childAbs = join(abs, name);
    if (watchers.has(childAbs) || isExcludedDir(relOf(childAbs))) return;
    let isDir = false;
    try {
      isDir = lstatSync(childAbs).isDirectory(); // Skip symlinks as in the initial walk.
    } catch {
      return;
    }
    if (!isDir) return;
    for (const sub of collectWatchDirs(childAbs, MAX_WATCHED_DIRS - watchers.size)) {
      watchDir(sub);
    }
    schedule();
  };

  for (const abs of collectWatchDirs(dir)) {
    watchDir(abs);
  }

  nitro.hooks.hook("close", () => {
    if (timer) clearTimeout(timer);
    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
  });
});
