<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
import { computed } from "vue";

const props = defineProps<{
  title?: string;
  icon?: string;
  /** Semantic color name driving the tint, e.g. primary | important | info. */
  color?: string;
  /** When set, the whole callout becomes a link. */
  to?: string;
}>();

/**
 * Map a semantic color name to Tailwind tint classes. Unknown colors fall
 * back to the "info" (blue) palette. Colors use a neutral scale so they
 * render sensibly in both light and dark modes.
 */
const COLOR_MAP: Record<string, string> = {
  primary: "border-[var(--ui-primary)]/30 bg-[var(--ui-primary)]/10 text-[var(--ui-primary)]",
  important: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  note: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  tip: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  success: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  caution: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  error: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

const tint = computed(() => COLOR_MAP[props.color || ""] || COLOR_MAP.info);

const tag = computed(() => (props.to ? AppLink : "div"));
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    class="prose-callout my-4 flex gap-3 rounded-lg border px-4 py-3"
    :class="[tint, to ? 'transition hover:brightness-110' : '']"
  >
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-5 shrink-0" />
    <div class="callout-body min-w-0 flex-1 text-[var(--ui-text)]">
      <p v-if="title" class="mb-1 font-bold select-none">{{ title }}</p>
      <slot />
    </div>
  </component>
</template>

<style scoped>
/* When the whole callout is a link (`to`), the root is an <a> that would pick up
   the global `.md a` underline across every wrapped line. Strip it here — the
   `a.prose-callout` + scope attribute out-specifies `.md a`. */
a.prose-callout,
a.prose-callout:hover {
  text-decoration: none;
}

/* Tighten default prose spacing inside a callout. */
.callout-body :deep(> :first-child) {
  margin-top: 0;
}
.callout-body :deep(> :last-child) {
  margin-bottom: 0;
}
/* Links inside a callout inherit the tint color and drop the default markdown
   underline (the "extra underscore") in every state — the color + weight are
   affordance enough; hover just softens the opacity. */
.callout-body :deep(a) {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}
.callout-body :deep(a:hover) {
  text-decoration: none;
  opacity: 0.8;
}
</style>
