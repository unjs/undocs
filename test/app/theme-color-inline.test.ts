import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  userBrandCss,
  THEME_COLOR_STORAGE_KEY,
  USER_BRAND_STYLE_ID,
} from "../../src/app/theme-brand.ts";

/**
 * Exercises the COMPILED `inline/theme-color.js` — the exact bytes
 * `entry-server.ts` inlines into `<head>`.
 *
 * What matters here is the `<style>` this leaves behind before the first paint.
 * The SSR shell inlines the DOCS PROJECT's accent, because a visitor's own pick
 * lives in `localStorage` and is not in the request; anything this gets wrong is
 * a visible colour flash on every cold load, on the links and the nav a docs
 * page is mostly made of.
 *
 * It also has to agree EXACTLY with the app-side driver
 * (`composables/useThemeColor.ts`) — same key, same validation, same CSS, same
 * element id — because the driver later updates the very tag this creates rather
 * than adding a second one.
 */
const SCRIPT = readFileSync(
  fileURLToPath(new URL("../../src/app/inline/theme-color.js", import.meta.url)),
  "utf8",
);

/**
 * Run the program against a fake document and report what it appended to
 * `<head>`.
 *
 * @param stored value in localStorage (`null` = never picked), or `"throw"` to
 * simulate blocked storage.
 */
function run(stored: string | null | "throw") {
  const appended: { id: string; textContent: string }[] = [];
  let readKey: string | undefined;

  const document = {
    createElement: () => ({ id: "", textContent: "" }),
    head: {
      append(node: { id: string; textContent: string }) {
        appended.push(node);
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

  const fn = new Function("document", "localStorage", SCRIPT);
  fn(document, localStorage);

  return { style: appended[0], count: appended.length, readKey };
}

describe("theme-color inline script", () => {
  it("reads the same storage key as the composable", () => {
    expect(run(null).readKey).toBe(THEME_COLOR_STORAGE_KEY);
  });

  it("applies a stored pick under the id the driver later updates", () => {
    const { style, count } = run("purple");
    expect(count).toBe(1);
    expect(style.id).toBe(USER_BRAND_STYLE_ID);
    expect(style.textContent).toBe(userBrandCss("purple"));
  });

  /**
   * The emission is `userBrandCss` itself, not a re-implementation of it: this is
   * the one place a hand-inlined copy would be tempting (every byte here ships on
   * every HTML response) and the one place a copy would be worst — a hover pole
   * that disagreed with the driver's would flip direction one tick after mount.
   */
  it.each(["mono", "blue", "teal", "amber"])("emits exactly `userBrandCss` for %s", (color) => {
    expect(run(color).style.textContent).toBe(userBrandCss(color));
  });

  /**
   * No pick, junk, an alias the picker never writes, blocked storage — all the
   * same thing: emit NOTHING, so the docs project's own accent (already inlined
   * by the server, at a lower specificity) is what paints. Emitting an empty tag
   * instead would be harmless today and a trap the first time something reads the
   * tag's presence as "the visitor has chosen".
   */
  it.each([null, "violet", "#ff8800", "sepia", "", "throw" as const])(
    "leaves the project's accent alone for %s",
    (stored) => {
      expect(run(stored).count).toBe(0);
    },
  );
});
