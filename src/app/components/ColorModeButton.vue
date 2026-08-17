<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
/**
 * ColorModeButton — the light/dark toggle, as one icon button.
 *
 * It used to be a sliding pill switch with its own hand-rolled `role="switch"` /
 * `data-state` markup. A switch states a fact ("dark mode: on"), which needs a
 * label to say WHICH fact and a thumb position to read it off; the control has
 * exactly one job, and the button says it in one glyph. So it is now the same
 * `Button` (`ghost`/`neutral`, icon-only) the socials and the blog link beside
 * it in `AppHeaderActions` render — one control shape across the whole action
 * cluster, one hover fill, one focus ring, and the `--size-*` ladder instead of
 * a bespoke `h-6 w-11`.
 *
 * The glyph is the CURRENT mode (moon in dark, sun in light) and the label is
 * the ACTION ("Switch to light mode"), which is the pairing a visitor reads
 * fastest: the icon answers "what am I in", the tooltip/`aria-label` answers
 * "what does this do". It is a plain button, not `aria-pressed` — the label
 * already changes with the state, and announcing "pressed" on top of it says the
 * same thing twice, differently.
 *
 * The resolved mode is client-only (localStorage / system preference), so we
 * report the SSR default (dark, matching the shell's `<html class="dark">`)
 * until mounted, keeping the server and first client render identical.
 *
 * Rendered in the header's action row at `md+` and at the foot of the mobile
 * drawer below that (`AppHeader`'s `#body-footer`).
 */
const cm = useColorMode();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const isDark = computed(() => (mounted.value ? cm.value === "dark" : true));

const label = computed(() => (isDark.value ? "Switch to light mode" : "Switch to dark mode"));

// An embedder pinning the mode via the URL fragment makes the toggle a no-op —
// hide it. Gated on `mounted` for the same reason as `isDark`: `forced` is
// client-only, so the first client render must still match the SSR output.
const hidden = computed(() => mounted.value && cm.forced);

function toggle() {
  cm.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
  <Tooltip v-if="!hidden" :text="label">
    <Button
      :aria-label="label"
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      size="lg"
      color="neutral"
      variant="ghost"
      @click="toggle"
    />
  </Tooltip>
</template>
