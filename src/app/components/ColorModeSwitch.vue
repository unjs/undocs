<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import Icon from "@app/components/global/Icon.vue";
/**
 * ColorModeSwitch — a sliding pill light/dark toggle (inspired by reka-ui's
 * ThemeToggle), replacing the plain icon `ColorModeButton` in the header. The
 * thumb carries a sun/moon glyph and slides across on toggle.
 *
 * It rides the header bar at `lg+` only; below that `AppHeaderActions` folds the
 * same toggle into its `...` menu as a checkbox item, so the narrow bar keeps
 * room for the search.
 *
 * The resolved mode is client-only (localStorage / system preference), so — like
 * `ColorModeButton` — we report the SSR default (dark, matching the shell's
 * `<html class="dark">`) until mounted, keeping the server and first client
 * render identical to avoid a hydration mismatch on the thumb position.
 *
 * The markup was reka-ui's `SwitchRoot`/`SwitchThumb` (MIT,
 * https://github.com/unovue/reka-ui) and is now the plain `<button>`/`<span>`
 * pair below. The attribute contract is reproduced exactly, because it is what
 * the styling and the a11y tree hang off: `role="switch"` + `aria-checked` on
 * the root, and `data-state="checked" | "unchecked"` on BOTH root and thumb —
 * the thumb's travel is `data-[state=checked]:translate-x-5`, so that attribute
 * is load-bearing, not decoration.
 *
 * What reka's primitive adds beyond that, and why none of it is missed here:
 * a two-element root/thumb context (both elements live in this one template,
 * so the state is just `isDark`); a `keydown.enter` handler with
 * `preventDefault` (only needed because reka's `as` prop lets the root be a
 * non-button — a real `<button>` already activates on Enter AND Space); a
 * hidden mirror `<input type="checkbox">` for form participation, which only
 * mounts when a `name` is given inside a `<form>` (this toggle is neither); and
 * `trueValue`/`falseValue`/`defaultValue` plumbing for non-boolean models. The
 * `aria-label` is passed explicitly, so reka's `document.querySelector('[for]')`
 * label lookup — which would have been a DOM read during render — is gone too.
 */
const cm = useColorMode();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const isDark = computed<boolean>({
  get: () => (mounted.value ? cm.value === "dark" : true),
  set: (v) => {
    cm.preference = v ? "dark" : "light";
  },
});

// An embedder pinning the mode via the URL fragment makes the toggle a no-op —
// hide it. Gated on `mounted` for the same reason as `isDark`: `forced` is
// client-only, so the first client render must still match the SSR output.
const hidden = computed(() => mounted.value && cm.forced);
</script>

<template>
  <button
    v-if="!hidden"
    type="button"
    role="switch"
    :aria-checked="isDark"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :data-state="isDark ? 'checked' : 'unchecked'"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    @click="isDark = !isDark"
  >
    <span
      :data-state="isDark ? 'checked' : 'unchecked'"
      class="flex size-5 translate-x-0.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-transform will-change-transform data-[state=checked]:translate-x-5"
    >
      <Icon :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" class="size-3" />
    </span>
  </button>
</template>
