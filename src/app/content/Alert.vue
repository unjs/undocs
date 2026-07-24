<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import { computed } from "vue";

const props = defineProps<{
  /** One of: note | tip | important | warning | caution (case-insensitive). */
  type?: string;
}>();

/** Per-type icon + color + title, keyed by the normalized (lowercased) type. */
const TYPES: Record<string, { icon: string; color: string; title: string }> = {
  note: { icon: "i-lucide-info", color: "info", title: "Note" },
  tip: { icon: "i-lucide-lightbulb", color: "tip", title: "Tip" },
  important: {
    icon: "i-lucide-message-square-warning",
    color: "important",
    title: "Important",
  },
  warning: { icon: "i-lucide-triangle-alert", color: "warning", title: "Warning" },
  caution: { icon: "i-lucide-octagon-alert", color: "caution", title: "Caution" },
};

/**
 * Map a semantic color name to Tailwind tint classes. Colors use a neutral scale
 * so they render sensibly in both light and dark modes.
 */
const COLOR_MAP: Record<string, string> = {
  important: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  tip: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  caution: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

const meta = computed(() => TYPES[(props.type || "note").toLowerCase()] || TYPES.note);
const tint = computed(() => COLOR_MAP[meta.value.color] || COLOR_MAP.info);
</script>

<template>
  <div class="alert my-4 rounded-lg border px-4 py-3" :class="tint">
    <p class="alert-title mb-1.5 flex items-center gap-2 font-semibold select-none">
      <Icon :name="meta.icon" class="size-5 shrink-0" />
      <span>{{ meta.title }}</span>
    </p>
    <div class="alert-body text-[var(--ui-text)]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* The title is a <p>, so it inherits the global `.md p` top margin — strip it
   (the scope attribute out-specifies `.md p`) so it sits flush with `py-3`. */
.alert-title {
  margin-top: 0;
}

/* Content spans the full width of the callout — no icon-column indentation. */
.alert-body :deep(> :first-child) {
  margin-top: 0;
}
.alert-body :deep(> :last-child) {
  margin-bottom: 0;
}
/* Links inside the alert inherit the tint color and drop the default markdown
   underline; hover just softens the opacity. */
.alert-body :deep(a) {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}
.alert-body :deep(a:hover) {
  text-decoration: none;
  opacity: 0.8;
}
</style>
