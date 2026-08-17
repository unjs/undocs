<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
import Button from "@app/components/ui/Button.vue";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
import { computed, onMounted, ref } from "vue";

interface BannerAction {
  label?: string;
  icon?: string;
  to?: string;
  target?: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "soft" | "subtle" | "ghost" | "link";
}

const props = withDefaults(
  defineProps<{
    id?: string;
    icon?: string;
    title?: string;
    actions?: BannerAction[];
    to?: string;
    target?: string;
    color?: "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";
    close?: boolean | { size?: string; color?: string; variant?: string };
    closeIcon?: string;
    ui?: Record<string, unknown>;
    class?: unknown;
  }>(),
  {
    color: "primary",
    closeIcon: "i-lucide-x",
  },
);

const STORAGE_KEY = computed(() => `undocs-banner-${props.id ?? props.title ?? "default"}`);

// Read persisted dismissal after mount to preserve hydration parity.
const dismissed = ref(false);
onMounted(() => {
  if (window.localStorage.getItem(STORAGE_KEY.value) === "1") dismissed.value = true;
});

function dismiss(): void {
  dismissed.value = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY.value, "1");
  }
}

// Pair each status text with its derived tint; `primary` maps to the brand tint.
const colorClass = computed(() => {
  switch (props.color) {
    case "neutral":
    case "secondary":
      return "bg-muted text-foreground";
    case "error":
      return "bg-danger-tint text-danger";
    case "warning":
      return "bg-warning-tint text-warning";
    case "success":
      return "bg-success-tint text-success";
    case "info":
      return "bg-info-tint text-info";
    default:
      return "bg-brand/10 text-foreground";
  }
});

function normalizeActionColor(color?: string): "primary" | "neutral" | "white" {
  return color === "primary" || color === "neutral" || color === "white" ? color : "neutral";
}
</script>

<template>
  <div
    v-if="title && !dismissed"
    :class="
      cn(
        'relative flex w-full items-center justify-center gap-2 px-4 py-2 text-sm',
        colorClass,
        props.class,
      )
    "
  >
    <component
      :is="to ? AppLink : 'div'"
      :to="to"
      :target="target"
      class="flex flex-1 items-center justify-center gap-1.5 text-center font-medium"
    >
      <Icon v-if="icon" :name="icon" class="size-4 shrink-0" />
      <span class="truncate">{{ title }}</span>
    </component>

    <div v-if="actions?.length" class="flex shrink-0 items-center gap-1.5">
      <Button
        v-for="(action, i) in actions"
        :key="i"
        :label="action.label"
        :icon="action.icon"
        :to="action.to"
        :target="action.target"
        :size="action.size ?? 'xs'"
        :variant="action.variant ?? 'outline'"
        :color="normalizeActionColor(action.color)"
      />
    </div>

    <button
      v-if="close"
      type="button"
      class="absolute right-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md opacity-80 transition-opacity hover:bg-foreground/10 hover:opacity-100"
      aria-label="Dismiss banner"
      @click="dismiss"
    >
      <Icon :name="closeIcon" class="size-4" />
    </button>
  </div>
</template>
