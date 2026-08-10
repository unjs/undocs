// Tests: test/server/dev-watch.test.ts
import { watch, readdirSync, lstatSync, type FSWatcher } from "node:fs";
import { join, relative, sep } from "node:path";
import { useRuntimeConfig } from "nitro/runtime-config";
import { definePlugin as defineNitroPlugin } from "nitro";
import { invalidateIndex } from "./content/store";
import { EXCLUDE } from "./content/builder";
import { broadcastReload } from "./dev-reload";

// Dev-only Nitro plugin: watches the docs dir and, on a Markdown/YAML change,
// drops the cached content index + tells connected browsers to refresh. Only
// registered in `nitro.config.ts` when NODE_ENV !== "production".
//
// It walks the tree itself and watches each directory NON-recursively instead
// of using `watch(dir, { recursive: true })`. On Linux Node implements the
// recursive mode by adding one inotify watch per directory with no way to skip
// any — so a docs project with its own `node_modules` burned thousands of
// watches (3192 dirs on a nitro docs checkout, against the 8 we actually scan)
// out of the shared `fs.inotify.max_user_watches` budget, and the resulting
// ENOSPC came back as an *unhandled* `error` event that killed the dev server.
// Walking ourselves lets us reuse the builder's EXCLUDE rules (never watch what
// we never scan) and attach an error handler per watcher.

// Backstop for a pathological tree: past this we stop adding watchers rather
// than exhaust the system's inotify budget. Content dirs number in the dozens.
const MAX_WATCHED_DIRS = 2048;

const isExcludedDir = (rel: string) => EXCLUDE.some((re) => re.test(`/${rel}/`));

/**
 * Directories to watch under `root`, breadth-first, skipping everything the
 * content builder excludes (dotfiles, `node_modules`, `dist`, `.docs`).
 * Symlinked dirs are not followed — they can form cycles, and the recursive
 * `fs.watch` this replaces didn't follow them either.
 */
export function collectWatchDirs(root: string, max = MAX_WATCHED_DIRS): string[] {
  const dirs: string[] = [root];
  const queue: Array<[abs: string, rel: string]> = [[root, ""]];
  while (queue.length > 0 && dirs.length < max) {
    const [abs, rel] = queue.shift()!;
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue; // unreadable/removed mid-walk
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

  // Path relative to the docs dir, in posix form — what EXCLUDE matches on.
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
      return; // dir vanished, or the platform refused the watch
    }
    // ENOSPC (and friends) arrive asynchronously; without a listener Node
    // rethrows them as an uncaught 'error' event and the dev server dies.
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
    // Anything else may be a directory appearing (rename/move-in). Its own
    // files never reach us until we watch it, so pick up the new subtree and
    // rebuild — a new dir under the docs dir is a content change either way.
    const childAbs = join(abs, name);
    if (watchers.has(childAbs) || isExcludedDir(relOf(childAbs))) return;
    let isDir = false;
    try {
      isDir = lstatSync(childAbs).isDirectory(); // `l`: symlinks are skipped, as in the walk
    } catch {
      return; // already removed again
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
