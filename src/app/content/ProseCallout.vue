<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
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
 * Map a semantic color name to a status role. Unknown colors fall back to
 * "info". Each role is a triple — text, the tint it sits on, and a border — and
 * all three flip in `.dark` together, so none of these need a `dark:` variant.
 * `tokens.test.ts` asserts every role clears WCAG AA on its own tint.
 *
 * `primary` is the odd one out: it tracks the project's `themeColor` rather than
 * a fixed role, so it mixes its own tint from `--brand`. That works because
 * `--brand` is derived to clear AA on a wash of itself — see `tokens.css`.
 */
const COLOR_MAP: Record<string, string> = {
  primary: "border-brand/30 bg-brand/10 text-brand",
  important: "border-important-border bg-important-tint text-important",
  info: "border-info-border bg-info-tint text-info",
  note: "border-info-border bg-info-tint text-info",
  tip: "border-success-border bg-success-tint text-success",
  success: "border-success-border bg-success-tint text-success",
  warning: "border-warning-border bg-warning-tint text-warning",
  caution: "border-danger-border bg-danger-tint text-danger",
  error: "border-danger-border bg-danger-tint text-danger",
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
    <div class="callout-body min-w-0 flex-1 text-foreground">
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
