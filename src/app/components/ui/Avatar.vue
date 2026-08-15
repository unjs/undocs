<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
/**
 * Avatar — the `UAvatar` replacement.
 *
 * Fallback renders initials derived from `alt`. `size` accepts the scale
 * `3xs`..`3xl`; unknown values fall back to `md`.
 *
 * Ported from reka-ui's `AvatarRoot`/`AvatarImage`/`AvatarFallback` (MIT,
 * https://github.com/unovue/reka-ui). What that trio actually gives you is one
 * piece of behaviour: a load state machine, with the image mounted but hidden
 * until it reports `loaded` and the initials rendered until then — so exactly
 * one of the two is ever visible, and a broken/404 `src` degrades to initials
 * instead of a broken-image glyph. That is reproduced below; the markup and
 * classes are unchanged.
 *
 * Two differences from reka, both deliberate:
 *
 * - reka tracks the status on a PHANTOM `new Image()` created in `onMounted`,
 *   mirroring `src` onto it, and ignores the `<img>` it actually renders. We
 *   listen to the rendered element instead. Same states, one fewer request in
 *   theory and — the reason for the change — a hydration that does not flash:
 *   the SSR'd `<img>` starts fetching from the HTML itself, so by the time
 *   `onMounted` runs it is frequently already `complete`, and the
 *   `complete && naturalWidth > 0` probe (reka's own `resolveLoadingStatus`
 *   test, applied to the real element) flips straight to `loaded` in the same
 *   tick as hydration. A phantom image constructed at mount can only ever
 *   resolve asynchronously, i.e. one frame of initials on every page load.
 *   `status` still starts at `loading` on both sides of the hydration boundary,
 *   so the server render and the client's FIRST render are identical — the
 *   probe runs in `onMounted`, as the hydration-parity invariant requires.
 * - The context/provide plumbing (`AvatarRoot` publishing `imageLoadingStatus`
 *   to descendants) is gone: it exists so consumers can compose their own
 *   fallback anywhere in the subtree. Our root, image and fallback are all in
 *   this one file, so a local ref does the job.
 *
 * `AvatarFallback`'s `delayMs` (suppress the initials for N ms, so a fast image
 * never flashes them) is dropped — our wrapper never passed it, and with the
 * real-element probe above the case it papers over is largely gone.
 */
import { computed, onMounted, ref, watch } from "vue";

const props = defineProps<{
  src?: string;
  alt?: string;
  size?: "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  class?: unknown;
}>();

const sizeClasses: Record<string, string> = {
  "3xs": "size-4 text-[8px]",
  "2xs": "size-5 text-[9px]",
  xs: "size-6 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-8 text-sm",
  lg: "size-9 text-sm",
  xl: "size-10 text-base",
  "2xl": "size-11 text-base",
  "3xl": "size-12 text-lg",
};

const sizeClass = computed(() => sizeClasses[props.size ?? "md"] ?? sizeClasses.md);

const imageEl = ref<HTMLImageElement | null>(null);
const status = ref<"loading" | "loaded" | "error">("loading");

// A new `src` restarts the machine; the browser fires `load`/`error` again for
// it (even from cache), so there is nothing else to re-probe here.
watch(
  () => props.src,
  () => {
    status.value = "loading";
  },
);

onMounted(() => {
  const el = imageEl.value;
  // Already settled before Vue attached its listeners — the common case for an
  // SSR'd (or cached) image. `naturalWidth` separates a decoded image from a
  // request that completed in failure.
  if (el?.complete) status.value = el.naturalWidth > 0 ? "loaded" : "error";
});

const initials = computed(() => {
  const name = props.alt?.trim();
  if (!name) return "";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
});
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted align-middle font-medium text-muted-foreground',
        sizeClass,
        props.class,
      )
    "
  >
    <img
      v-if="src"
      v-show="status === 'loaded'"
      ref="imageEl"
      role="img"
      :src="src"
      :alt="alt"
      class="h-full w-full object-cover"
      @load="status = 'loaded'"
      @error="status = 'error'"
    />
    <span v-if="status !== 'loaded'" class="flex h-full w-full items-center justify-center">
      {{ initials }}
    </span>
  </span>
</template>
