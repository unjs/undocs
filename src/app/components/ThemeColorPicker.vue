<script setup lang="ts">
/**
 * The swatch grid must remain inside the hover wrapper; descendant transitions
 * then do not trigger `pointerleave`, and padding bridges the trigger-to-grid gap.
 * Closed swatches stay mounted for exit transitions but are `inert` so they
 * cannot receive focus or pointer input. Rendering waits until mount because the
 * selected accent comes from client-only storage.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { cn } from "@app/utils/cn.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useThemeColor } from "@app/composables/useThemeColor.ts";
import {
  THEME_COLORS,
  resolveThemeColor,
  themeColorToken,
  type ThemeColor,
} from "@app/theme-brand.ts";

const theme = useThemeColor();
const appConfig = useAppConfig();

const LABELS: Record<ThemeColor, string> = {
  mono: "Monochrome",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
  amber: "Amber",
  green: "Green",
  teal: "Teal",
};

const projectColor = computed(() => resolveThemeColor(appConfig.ui?.colors?.primary));
const selected = computed(() => theme.value ?? projectColor.value);

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

// `forced` is client-only, so preserve the SSR shape until mount.
const visible = computed(() => mounted.value && !theme.forced);

// Keep in sync with the literal `grid-cols-4` class Tailwind scans below.
const COLUMNS = 4;
const rowOf = (index: number): number => Math.floor(index / COLUMNS);
const columnOf = (index: number): number => index % COLUMNS;

const open = ref(false);

function choose(color: ThemeColor): void {
  theme.value = color;
  theme.preview = null;
  open.value = false;
}

function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === "touch") return;
  open.value = true;
}

function onLeave(): void {
  open.value = false;
  theme.preview = null;
}

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  const wrapper = event.currentTarget as HTMLElement;
  if (!(next instanceof Node) || !wrapper.contains(next)) {
    open.value = false;
    theme.preview = null;
  }
}

// Shared preview state must not survive this component.
onBeforeUnmount(() => {
  theme.preview = null;
});
</script>

<template>
  <div
    class="relative"
    @pointerenter="onPointerEnter"
    @pointerleave="onLeave"
    @focusin="open = true"
    @focusout="onFocusOut"
    @keydown.escape="open = false"
  >
    <slot />

    <div
      v-if="visible"
      :inert="!open"
      role="group"
      aria-label="Accent color"
      :class="
        cn(
          // Padding keeps the pointer path inside the hover wrapper.
          'absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2',
          // Prevent the centred absolute box from shrink-to-fitting to one column.
          'w-max',
          'grid grid-cols-4 justify-items-center gap-1.5',
          'transition-[opacity,transform] duration-200 ease-out',
          open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        )
      "
    >
      <button
        v-for="(color, index) in THEME_COLORS"
        :key="color"
        type="button"
        :aria-label="LABELS[color]"
        :aria-pressed="selected === color"
        class="relative size-4 shrink-0 rounded-sm shadow-small transition-[transform,opacity] duration-200 ease-out hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90"
        :class="open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-50 opacity-0'"
        :style="{
          background: themeColorToken(color),
          transitionDelay: open ? `${rowOf(index) * 60 + columnOf(index) * 20}ms` : '0ms',
        }"
        @click="choose(color)"
        @pointerenter="theme.preview = color"
        @pointerleave="theme.preview = null"
        @focus="theme.preview = color"
        @blur="theme.preview = null"
      >
        <span
          v-if="selected === color"
          class="absolute -inset-[3px] rounded-[calc(var(--radius)_+_1px)] border-2"
          :style="{ borderColor: themeColorToken(color) }"
        />
      </button>
    </div>
  </div>
</template>
