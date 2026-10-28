/**
 * useColorMode — the color-mode driver.
 *
 * This composable is the sole driver of color-mode: it toggles the `.dark`
 * (and `.light`) class on `document.documentElement` and persists the
 * preference to `localStorage` (key `undocs-color-mode`).
 *
 * Shape: `{ preference, value, system, forced }`. Consumers read/set
 * `.preference` (`"light" | "dark" | "system"`); `.value` is the resolved
 * concrete mode (`"light" | "dark"`) and `.system` is what the OS asks for.
 * Setting `.preference` re-applies the class and persists it (reactive
 * watcher); nothing is stored until the visitor first changes it. `.forced` is set when an embedder
 * pinned the mode via the URL fragment — the preference is then fixed and the
 * UI hides its toggle (`ColorModeButton.vue`, in the header at `md+` and at the
 * foot of the mobile drawer below it).
 *
 * `init()` runs lazily on first `useColorMode()` call; main.ts also calls it at
 * startup so the class is applied before the app mounts. `main.css` maps those
 * classes to CSS `color-scheme`, which is what resolves the `light-dark()`
 * colours rangi inlines into every highlighted token.
 *
 * The class is applied EARLIER still — before the first paint — by the inline
 * `inline/color-mode.ts` program, which reads the same key from the same
 * storage and so reaches the same answer; this is the durable owner of the
 * state, the toggle and persistence. What the inline program cannot fix is the
 * SSR-rendered DOM: the server always renders the default mode, so anything
 * rendering FROM the mode must still show the default on its first client
 * render and correct itself `onMounted`, or hydration mismatches. The one way
 * round that is CSS: `ColorModeButton` renders every glyph and lets the
 * `COLOR_MODE_ATTRIBUTE` both programs keep on `<html>` pick which one shows.
 */
import { reactive, watch } from "vue";
import { FORCED_MODE_GLOBAL } from "@app/embed-theme.ts";
import { readStorage, writeStorage } from "@app/utils/storage.ts";
import {
  COLOR_MODE_ATTRIBUTE,
  COLOR_MODE_STORAGE_KEY as STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  isColorModePreference,
  type ColorModePreference,
  type ColorModeValue,
} from "@app/color-mode.ts";

const state = reactive({
  preference: DEFAULT_COLOR_MODE as ColorModePreference,
  value: DEFAULT_COLOR_MODE as ColorModeValue,
  /** What the OS asks for — what `system` resolves to, and what the toggle's cycle order turns on. */
  system: DEFAULT_COLOR_MODE as ColorModeValue,
  forced: false,
});

let _initialized = false;

function apply(): void {
  state.value = state.preference === "system" ? state.system : state.preference;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.toggle("dark", state.value === "dark");
    root.classList.toggle("light", state.value === "light");
    root.setAttribute(COLOR_MODE_ATTRIBUTE, state.preference);
  }
}

function init(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  // An embedder can pin the mode through the URL fragment (`#~<base64url>` with
  // `m: "l" | "d"`); the inline head script in `entry-server.ts` has already
  // applied the class and left this global behind. Take it as authoritative:
  // no stored preference, no system watcher, no persistence — otherwise the
  // visitor's own localStorage would silently override the embedder a tick
  // after mount. `forced` lets the UI hide its toggle.
  const pinned = (window as any)[FORCED_MODE_GLOBAL] as ColorModeValue | undefined;
  if (pinned === "light" || pinned === "dark") {
    state.preference = pinned;
    state.forced = true;
    apply();
    return;
  }

  // Validated like the inline program does: an unknown value falls back to the
  // default instead of becoming a preference the UI cannot represent. Read
  // through `readStorage`, because blocked storage throws here, during
  // `bootstrap()`, and the app would never mount.
  const stored = readStorage(STORAGE_KEY);
  if (isColorModePreference(stored)) state.preference = stored;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  state.system = media.matches ? "dark" : "light";
  media.addEventListener("change", (event) => {
    state.system = event.matches ? "dark" : "light";
    apply();
  });
  apply();

  // Persist only what the visitor CHOSE. Not `immediate`, so a first visit
  // stores nothing: "never chose" stays distinguishable from "chose the
  // default", and a later change to `DEFAULT_COLOR_MODE` reaches every visitor
  // who never picked one.
  watch(
    () => state.preference,
    (pref) => {
      writeStorage(STORAGE_KEY, pref);
      apply();
    },
  );
}

export function useColorMode(): typeof state {
  init();
  return state;
}
