<script setup lang="ts">
import { cn } from "@app/utils/cn";
/**
 * Avatar — the `UAvatar` replacement.
 *
 * Reka `AvatarRoot/Image/Fallback`. Fallback renders initials derived from
 * `alt`. `size` accepts the scale `3xs`..`3xl`; unknown values fall
 * back to `md`.
 */
import { computed } from "vue";
import { AvatarRoot, AvatarImage, AvatarFallback } from "reka-ui";

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

const initials = computed(() => {
  const name = props.alt?.trim();
  if (!name) return "";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
});
</script>

<template>
  <AvatarRoot
    :class="
      cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted align-middle font-medium text-muted-foreground',
        sizeClass,
        props.class,
      )
    "
  >
    <AvatarImage v-if="src" :src="src" :alt="alt" class="h-full w-full object-cover" />
    <AvatarFallback class="flex h-full w-full items-center justify-center">
      {{ initials }}
    </AvatarFallback>
  </AvatarRoot>
</template>
