/**
 * useColorMode — the color-mode driver.
 *
 * This composable is the sole driver of color-mode: it toggles the `.dark`
 * (and `.light`) class on `document.documentElement` and persists the
 * preference to `localStorage` (key `undocs-color-mode`).
 *
 * Shape: `{ preference, value, forced }`. Consumers read/set
 * `.preference` (`"light" | "dark" | "system"`); `.value` is the resolved
 * concrete mode (`"light" | "dark"`). Setting `.preference` re-applies the
 * class and re-persists (reactive watcher). `.forced` is set when an embedder
 * pinned the mode via the URL fragment — the preference is then fixed and the
 * UI hides its toggle (`ColorModeSwitch.vue`).
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
 * rendering FROM the mode (`ColorModeSwitch.vue`) must still show the default
 * on its first client render and correct itself `onMounted`, or hydration
 * mismatches.
 */
import { reactive, watch } from "vue";
import { FORCED_MODE_GLOBAL } from "@app/embed-theme";
import {
  COLOR_MODE_STORAGE_KEY as STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  type ColorModePreference,
  type ColorModeValue,
} from "@app/color-mode";

const state = reactive({
  preference: DEFAULT_COLOR_MODE as ColorModePreference,
  value: DEFAULT_COLOR_MODE as ColorModeValue,
  forced: false,
});

let _initialized = false;

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveValue(): ColorModeValue {
  if (state.preference === "system") return systemPrefersDark() ? "dark" : "light";
  return state.preference;
}

function apply(): void {
  state.value = resolveValue();
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", state.value === "dark");
    document.documentElement.classList.toggle("light", state.value === "light");
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

  const stored = window.localStorage.getItem(STORAGE_KEY) as ColorModePreference | null;
  if (stored) state.preference = stored;
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => state.preference === "system" && apply());
  watch(
    () => state.preference,
    (pref) => {
      window.localStorage.setItem(STORAGE_KEY, pref);
      apply();
    },
    { immediate: true },
  );
}

export function useColorMode(): typeof state {
  init();
  return state;
}
