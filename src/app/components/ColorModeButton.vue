<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import {
  DEFAULT_COLOR_MODE,
  nextColorModePreference,
  type ColorModePreference,
  type ColorModeValue,
} from "@app/color-mode.ts";
import Button from "@app/components/ui/Button.vue";
import Icon from "@app/components/global/Icon.vue";
import { cn } from "@app/utils/cn.ts";

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

// The glyph is picked in CSS from `COLOR_MODE_ATTRIBUTE` on `<html>`, which the
// inline program sets before the first paint, so every glyph is in the markup
// on both sides and the right one shows before the app mounts. No attribute
// (never chose, or no inline program) shows the moon, the default's glyph.
// Keep the literal attribute in sync with `COLOR_MODE_ATTRIBUTE`.
const GLYPHS = [
  {
    icon: "i-lucide-moon",
    class: "[[data-color-preference=light]_&]:hidden [[data-color-preference=system]_&]:hidden",
  },
  { icon: "i-lucide-sun", class: "hidden [[data-color-preference=light]_&]:block" },
  { icon: "i-lucide-monitor", class: "hidden [[data-color-preference=system]_&]:block" },
];

// The label has no CSS route, so it shows the SSR default until mounted.
const preference = computed<ColorModePreference>(() =>
  mounted.value ? cm.preference : DEFAULT_COLOR_MODE,
);
const system = computed<ColorModeValue>(() => (mounted.value ? cm.system : DEFAULT_COLOR_MODE));

const next = computed(() => nextColorModePreference(preference.value, system.value));

// The step out of `system` is the one that leaves the theme alone (see
// `nextColorModePreference`), so its label says what it does instead.
const label = computed(() =>
  preference.value === "system"
    ? `Color mode: system (${system.value}). Always use ${next.value} mode`
    : `Color mode: ${preference.value}. Switch to ${next.value} mode`,
);

// `forced` is client-only, so preserve the SSR shape until mount.
const hidden = computed(() => mounted.value && cm.forced);

function cycle() {
  cm.preference = nextColorModePreference(cm.preference, cm.system);
}
</script>

<template>
  <Button
    v-if="!hidden"
    :aria-label="label"
    square
    size="lg"
    variant="ghost"
    :class="cn(accentGlow && '[&_svg]:drop-shadow-[0_0_6px_var(--brand)]', props.class)"
    @click="cycle"
  >
    <Icon v-for="glyph in GLYPHS" :key="glyph.icon" :name="glyph.icon" :class="glyph.class" />
  </Button>
</template>
