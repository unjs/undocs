<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
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
   * moon/sun outline — the blur is what keeps it soft, so the colour is used at
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

const isDark = computed(() => (mounted.value ? cm.value === "dark" : true));

const label = computed(() => (isDark.value ? "Switch to light mode" : "Switch to dark mode"));

// `forced` is client-only, so preserve the SSR shape until mount.
const hidden = computed(() => mounted.value && cm.forced);

function toggle() {
  cm.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
  <Button
    v-if="!hidden"
    :aria-label="label"
    :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
    size="lg"
    variant="ghost"
    :class="cn(accentGlow && '[&_svg]:drop-shadow-[0_0_6px_var(--brand)]', props.class)"
    @click="toggle"
  />
</template>
