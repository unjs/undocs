import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COLOR_MODE_STORAGE_KEY, DEFAULT_COLOR_MODE } from "../../src/app/color-mode.ts";

/**
 * Exercises the COMPILED `inline/color-mode.js` — the exact bytes
 * `entry-server.ts` inlines into `<head>`.
 *
 * What matters here is the CLASS this leaves on `<html>` before the first
 * paint: the SSR shell ships the default mode, so anything this gets wrong is a
 * visible flash (or, worse, a permanently wrong mode if the app-side driver
 * later agrees with it).
 */
const SCRIPT = readFileSync(
  fileURLToPath(new URL("../../src/app/inline/color-mode.js", import.meta.url)),
  "utf8",
);

/**
 * Run the program against a fake document whose `<html>` starts with the class
 * the SSR shell ships, and report the classes it ends up with.
 *
 * @param stored value in localStorage (`null` = never chosen), or `"throw"` to
 * simulate blocked storage.
 * @param systemDark what `prefers-color-scheme: dark` matches.
 */
function run(stored: string | null | "throw", systemDark = false) {
  const classes = new Set<string>([DEFAULT_COLOR_MODE]);
  let readKey: string | undefined;
  let mediaQuery: string | undefined;

  const document = {
    documentElement: {
      classList: {
        toggle(name: string, force: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
    },
  };

  const localStorage = {
    getItem(key: string) {
      readKey = key;
      if (stored === "throw") throw new Error("SecurityError");
      return stored;
    },
  };

  const matchMedia = (query: string) => {
    mediaQuery = query;
    return { matches: systemDark };
  };

  const fn = new Function("document", "localStorage", "matchMedia", SCRIPT);
  fn(document, localStorage, matchMedia);

  return { classes: [...classes].sort(), readKey, mediaQuery };
}

describe("color-mode inline script", () => {
  it("reads the same storage key as the composable", () => {
    expect(run(null).readKey).toBe(COLOR_MODE_STORAGE_KEY);
  });

  it("applies an explicitly stored preference", () => {
    expect(run("light").classes).toEqual(["light"]);
    expect(run("dark").classes).toEqual(["dark"]);
  });

  it("resolves `system` against the OS setting", () => {
    const light = run("system", false);
    expect(light.classes).toEqual(["light"]);
    expect(light.mediaQuery).toBe("(prefers-color-scheme: dark)");
    expect(run("system", true).classes).toEqual(["dark"]);
  });

  it("leaves the SSR default in place for a first-time visitor", () => {
    // No stored preference and no work to do — this is the flash-free path that
    // makes the shell's hardcoded class correct.
    expect(run(null).classes).toEqual([DEFAULT_COLOR_MODE]);
    expect(run(null, true).classes).toEqual([DEFAULT_COLOR_MODE]);
  });

  it("falls back to the default when storage is blocked", () => {
    expect(run("throw").classes).toEqual([DEFAULT_COLOR_MODE]);
  });

  it("ignores a junk stored value rather than applying no class", () => {
    // A stale/corrupt entry must not leave `<html>` with neither class — that
    // would break the `color-scheme` mapping and every `light-dark()` token.
    expect(run("sepia").classes).toEqual([DEFAULT_COLOR_MODE]);
  });
});
