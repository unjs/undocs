<script setup lang="ts">
/**
 * Steps
 * -----
 * Renders a vertical, numbered steps list. The slot contains a sequence of
 * headings (usually `h4`) followed by their content. Numbering and the guide
 * line are produced purely with CSS counters so the markup stays defensive —
 * whatever the slot emits is rendered verbatim.
 */
defineProps<{
  level?: string;
}>();
</script>

<template>
  <div class="steps">
    <slot />
  </div>
</template>

<style scoped>
.steps {
  counter-reset: step;
  margin: 1.25rem 0;
  padding-left: 2rem;
  border-left: 1px solid var(--ui-border);
}

/* Each heading becomes a numbered step marker. */
.steps :deep(h1),
.steps :deep(h2),
.steps :deep(h3),
.steps :deep(h4),
.steps :deep(h5),
.steps :deep(h6) {
  position: relative;
  counter-increment: step;
  margin-top: 1.5rem;
}

.steps :deep(h1):first-child,
.steps :deep(h2):first-child,
.steps :deep(h3):first-child,
.steps :deep(h4):first-child,
.steps :deep(h5):first-child,
.steps :deep(h6):first-child {
  margin-top: 0;
}

.steps :deep(h1)::before,
.steps :deep(h2)::before,
.steps :deep(h3)::before,
.steps :deep(h4)::before,
.steps :deep(h5)::before,
.steps :deep(h6)::before {
  content: counter(step);
  position: absolute;
  left: -2.75rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}
</style>
