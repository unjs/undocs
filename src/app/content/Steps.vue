<script setup lang="ts">
 /**
 * Steps
 * -----
 * Renders a vertical, numbered steps list. Two authoring forms feed it, and
 * both are numbered purely with CSS counters so the markup stays defensive —
 * whatever the slot emits is rendered verbatim:
 *
 *  - hand-authored `::steps`, whose slot is a sequence of headings (usually
 *    `h4`) each followed by its content — the heading carries the number;
 *  - a plain numbered list, which the server transform rewrites to one `.step`
 *    wrapper per item — the wrapper carries the number and the item's content
 *    stays ordinary prose (no synthesized heading, so no bold text and no `#`
 *    deep-link).
 *
 * Only DIRECT children are counted, so a heading inside a step's body doesn't
 * bump the number.
 */
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
  border-left: 1px solid var(--border);
}

/* Each direct-child heading (`::steps`) or `.step` wrapper (numbered list)
   becomes a numbered step marker. */
.steps > :deep(h1),
.steps > :deep(h2),
.steps > :deep(h3),
.steps > :deep(h4),
.steps > :deep(h5),
.steps > :deep(h6),
.steps > :deep(.step) {
  position: relative;
  counter-increment: step;
  margin-top: 1.5rem;
}

.steps > :deep(h1):first-child,
.steps > :deep(h2):first-child,
.steps > :deep(h3):first-child,
.steps > :deep(h4):first-child,
.steps > :deep(h5):first-child,
.steps > :deep(h6):first-child,
.steps > :deep(.step):first-child {
  margin-top: 0;
}

/* A step's content is plain prose; trim its edge margins so the marker lines up
   with the first line and the steps space evenly. */
.steps > :deep(.step) > :first-child {
  margin-top: 0;
}
.steps > :deep(.step) > :last-child {
  margin-bottom: 0;
}

.steps > :deep(h1)::before,
.steps > :deep(h2)::before,
.steps > :deep(h3)::before,
.steps > :deep(h4)::before,
.steps > :deep(h5)::before,
.steps > :deep(h6)::before,
.steps > :deep(.step)::before {
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
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

/* A heading is a single line, so its marker centers on the whole block. A step
   wrapper is as tall as its body — pin the marker to its first line instead. */
.steps > :deep(.step)::before {
  top: 0;
  transform: translateY(0.125rem);
}
</style>
