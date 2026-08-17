<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import Button from "@app/components/ui/Button.vue";
import type { ButtonVariants } from "@app/components/ui/Button.ts";
// Storage/system mode is client-only; render the SSR default until mounted.
const props = withDefaults(
  defineProps<{
    color?: NonNullable<ButtonVariants["color"]>;
    class?: unknown;
  }>(),
  { color: "neutral" },
);

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
    :color="props.color"
    variant="ghost"
    :class="props.class"
    @click="toggle"
  />
</template>
