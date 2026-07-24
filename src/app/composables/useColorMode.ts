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
 * class and re-persists (reactive watcher).
 *
 * `init()` runs lazily on first `useColorMode()` call; main.ts also calls it at
 * startup so the class is applied before the app mounts. The Shiki dual-theme
 * CSS (ProsePre.vue, main.css) keys off `.dark` — unchanged.
 */
import { reactive, watch } from "vue";

type ColorModePreference = "light" | "dark" | "system";
type ColorModeValue = "light" | "dark";

const STORAGE_KEY = "undocs-color-mode";

const state = reactive({
  preference: "dark" as ColorModePreference,
  value: "dark" as ColorModeValue,
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
