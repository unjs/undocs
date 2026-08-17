/**
 * useThemeColor — the visitor's own accent pick.
 *
 * The docs project chooses the site's accent (`docs.themeColor` → `brandCss`,
 * inlined into `<head>` during SSR). This composable is the layer above it: a
 * visitor can override that accent for themselves, and the choice persists to
 * `localStorage` (key `undocs-theme-color`). `components/ThemeColorPicker.vue`
 * is the only writer.
 *
 * Shape: `{ value, preview, forced }`. `value` is the picked `ThemeColor`, or
 * `null` meaning "no pick" — which is NOT a colour of its own but the absence of
 * the override, so the project's own accent shows through. Setting `.value`
 * re-applies the `<style>` and re-persists (reactive watcher).
 *
 * `.preview` is the same thing WITHOUT the commitment: what the visitor is
 * hovering, applied to the whole site so they can see an accent on real links
 * and real nav rather than on a 16px circle, and dropped again the moment the
 * pointer leaves. It out-ranks `.value` while set and is never persisted, so
 * abandoning a preview needs no undo — clearing it re-applies whatever `.value`
 * already was. Which also means the two must share ONE `<style>` tag: a separate
 * preview tag would have to out-specify the committed one, and then clearing it
 * would be a removal rather than a re-render, i.e. a second code path for the
 * same question.
 *
 * The accent is applied EARLIER than this — before the first paint — by the
 * inline `inline/theme-color.ts` program, which reads the same key from the same
 * storage and emits the same CSS through the same `userBrandCss`, so the two
 * reach the same answer. This module is the durable owner of the state, the
 * picker and persistence; it UPDATES that tag in place rather than adding a
 * second one, which is what keeps its cascade position (established at parse
 * time, before the embed tag) stable across every subsequent pick.
 *
 * `.forced` is set when an embedder pinned the accent through the URL fragment
 * (`br`, see `embed-theme.ts`). That tag out-orders ours in the cascade, so a
 * pick would silently do nothing — the picker hides itself instead, exactly as
 * `ColorModeButton` does for a pinned color mode.
 *
 * Everything here is client-only: `init()` no-ops during SSR, so the server
 * renders the project's accent and the first client render must agree with it —
 * see the `mounted` gate in `ThemeColorPicker.vue`.
 */
import { reactive, watch } from "vue";
import { EMBED_STYLE_ID } from "@app/embed-theme.ts";
import {
  isThemeColor,
  userBrandCss,
  THEME_COLOR_STORAGE_KEY as STORAGE_KEY,
  USER_BRAND_STYLE_ID,
  type ThemeColor,
} from "@app/theme-brand.ts";

const state = reactive({
  value: null as ThemeColor | null,
  preview: null as ThemeColor | null,
  forced: false,
});

/** What is actually on screen: the hover preview if there is one, else the pick. */
function effective(): ThemeColor | null {
  return state.preview ?? state.value;
}

let _initialized = false;

/**
 * Did an embedder pin `--brand`?
 *
 * Read off the embed tag's own declarations rather than through a second global
 * of the `FORCED_MODE_GLOBAL` kind: the inline embed program's bytes ship on
 * every HTML response, and this question is only ever asked once, on the client,
 * long after that program ran. Iterating the rules (rather than indexing rule 0)
 * keeps it independent of how many rules the program inserted.
 */
function embedPinnedBrand(): boolean {
  const sheet = (document.getElementById(EMBED_STYLE_ID) as HTMLStyleElement | null)?.sheet;
  if (!sheet) return false;
  for (const rule of sheet.cssRules) {
    if ((rule as CSSStyleRule).style?.getPropertyValue("--brand")) return true;
  }
  return false;
}

function apply(): void {
  const css = userBrandCss(effective());
  let style = document.getElementById(USER_BRAND_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    // Nothing was stored at parse time, so the inline program emitted no tag.
    // Creating one only matters once there is something to put in it.
    if (!css) return;
    style = document.createElement("style");
    style.id = USER_BRAND_STYLE_ID;
    document.head.append(style);
  }
  // Emptied rather than removed when the pick is cleared, so the element (and
  // its position relative to the embed tag) survives the round trip.
  style.textContent = css ?? "";
}

function init(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  if (embedPinnedBrand()) {
    state.forced = true;
    return;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemeColor(stored)) state.value = stored;

  // Persistence follows the COMMITTED pick only — a preview the visitor walked
  // away from must leave no trace in storage.
  watch(
    () => state.value,
    (value) => {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    },
  );

  // Application follows whichever of the two is on top. Not `immediate`: the
  // inline program already applied exactly this, and the first thing an
  // immediate run would do is rewrite the tag with its own text.
  watch(effective, apply);
}

export function useThemeColor(): typeof state {
  init();
  return state;
}
