<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import { DEFAULT_COLOR_MODE, type ColorModePreference } from "@app/color-mode.ts";
import Button from "@app/components/ui/Button.vue";
import { cn } from "@app/utils/cn.ts";

// Storage/system mode is client-only; render the SSR default until mounted.
const props = defineProps<{
  /**
   * Cast the current accent as a soft glow under the icon — the trigger's half
   * of `ThemeColorPicker`, which owns the question of whether there IS an
   * accent to show (a monochrome one gets none: its `--brand` is `--foreground`,
   * so the glow would read as a blurry icon rather than as a colour). It is a
   * `drop-shadow` on the glyph itself, not a box shadow, so it follows the
   * glyph's outline — the blur is what keeps it soft, so the colour is used at
   * full strength rather than mixed down, which at this radius disappears; the colour comes straight from `--brand`, so it tracks the
   * picker's hover preview without this component watching it.
   */
  accentGlow?: boolean;
  class?: unknown;
}>();

const cm = useColorMode();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

// Each preference's glyph and the one a click moves to.
const CYCLE: Record<ColorModePreference, { icon: string; next: ColorModePreference }> = {
  dark: { icon: "i-lucide-moon", next: "light" },
  light: { icon: "i-lucide-sun", next: "system" },
  system: { icon: "i-lucide-monitor", next: "dark" },
};

const preference = computed<ColorModePreference>(() =>
  mounted.value ? cm.preference : DEFAULT_COLOR_MODE,
);

const icon = computed(() => CYCLE[preference.value].icon);

// In system mode, name the resolved mode too: the glyph alone does not say
// which theme is showing, so "switch to dark" could otherwise change nothing.
const label = computed(() => {
  const current = preference.value === "system" ? `system (${cm.value})` : preference.value;
  return `Color mode: ${current}. Switch to ${CYCLE[preference.value].next} mode`;
});

// `forced` is client-only, so preserve the SSR shape until mount.
const hidden = computed(() => mounted.value && cm.forced);

function cycle() {
  cm.preference = CYCLE[cm.preference].next;
}
</script>

<template>
  <Button
    v-if="!hidden"
    :aria-label="label"
    :icon="icon"
    size="lg"
    variant="ghost"
    :class="cn(accentGlow && '[&_svg]:drop-shadow-[0_0_6px_var(--brand)]', props.class)"
    @click="cycle"
  />
</template>
