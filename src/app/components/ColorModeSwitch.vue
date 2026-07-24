<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { useColorMode } from "@app/composables/useColorMode";
import Icon from "@app/components/global/Icon.vue";
/**
 * ColorModeSwitch — a sliding pill light/dark toggle (inspired by reka-ui's
 * ThemeToggle), replacing the plain icon `ColorModeButton` in the header. The
 * thumb carries a sun/moon glyph and slides across on toggle.
 *
 * The resolved mode is client-only (localStorage / system preference), so — like
 * `ColorModeButton` — we report the SSR default (dark, matching the shell's
 * `<html class="dark">`) until mounted, keeping the server and first client
 * render identical to avoid a hydration mismatch on the thumb position.
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
</script>

<template>
  <SwitchRoot
    v-model="isDark"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <SwitchThumb
      class="flex size-5 translate-x-0.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-transform will-change-transform data-[state=checked]:translate-x-5"
    >
      <Icon :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" class="size-3" />
    </SwitchThumb>
  </SwitchRoot>
</template>
