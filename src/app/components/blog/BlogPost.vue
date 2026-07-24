<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn";
import AppLink from "@app/components/app/AppLink";
interface Badge {
  label?: string;
  color?: string;
  variant?: string;
}

const props = withDefaults(
  defineProps<{
    to?: string;
    title?: string;
    description?: string;
    date?: string | number | Date;
    badge?: Badge;
    variant?: "outline" | "subtle";
    orientation?: "vertical" | "horizontal";
    class?: unknown;
  }>(),
  {
    variant: "outline",
    orientation: "vertical",
  },
);

const isHorizontal = computed(() => props.orientation === "horizontal");

const formattedDate = computed(() => {
  if (!props.date) {
    return "";
  }
  const d = new Date(props.date);
  if (Number.isNaN(d.getTime())) {
    return String(props.date);
  }
  // Format in UTC so the server (often UTC) and client (any timezone) produce
  // the same string — a timezone-relative format would flip the day for some
  // clients and cause a hydration mismatch under SSR.
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
});
</script>

<template>
  <component
    :is="to ? AppLink : 'div'"
    :to="to || undefined"
    :class="
      cn(
        'group flex rounded-lg border p-6 transition-colors',
        isHorizontal ? 'flex-col sm:flex-row gap-6 items-start' : 'flex-col gap-3',
        variant === 'subtle'
          ? 'border-border bg-muted/40 hover:bg-muted/60'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40',
        $props.class,
      )
    "
  >
    <div class="flex flex-col gap-3" :class="isHorizontal ? 'sm:flex-1' : ''">
      <div v-if="badge?.label || formattedDate" class="flex items-center gap-3">
        <span
          v-if="badge?.label"
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary"
        >
          {{ badge.label }}
        </span>
        <time v-if="formattedDate" class="text-xs text-muted-foreground">
          {{ formattedDate }}
        </time>
      </div>

      <h3
        v-if="title"
        class="font-semibold text-foreground group-hover:text-primary transition-colors"
        :class="isHorizontal ? 'text-2xl' : 'text-lg'"
      >
        {{ title }}
      </h3>

      <p v-if="description" class="text-sm text-muted-foreground text-pretty">
        {{ description }}
      </p>
    </div>
  </component>
</template>
