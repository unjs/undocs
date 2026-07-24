<!-- eslint-disable vue/no-v-html -->
<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import { computed, ref, useSlots } from "vue";
import { useCodeIcon } from "@app/composables/useCodeIcon";

const props = defineProps<{
  code?: string;
  filename?: string;
  language?: string;
  highlighted?: string;
  icon?: string;
  class?: any;
}>();

const slots = useSlots();
const hasSlot = computed(() => !!slots.default);

// The filename-bar icon, resolved from the theme `ui.prose.codeIcon` map.
const resolveCodeIcon = useCodeIcon();
const fileIcon = computed(() => resolveCodeIcon(props.filename, props.language, props.icon));

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard?.writeText(props.code ?? "");
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard may be unavailable (e.g. insecure context) — fail silently.
  }
}
</script>

<template>
  <div
    class="prose-pre group relative my-4 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)]"
    :class="props.class"
  >
    <!-- Optional filename header bar -->
    <div
      v-if="filename"
      class="flex items-center gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--ui-text-muted)]"
    >
      <Icon :name="fileIcon" class="size-3.5 shrink-0" />
      <span class="truncate">{{ filename }}</span>
    </div>

    <!-- Copy-to-clipboard button (top-right) -->
    <button
      type="button"
      class="absolute right-2 z-10 inline-flex size-7 items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] text-[var(--ui-text-muted)] opacity-0 transition hover:text-[var(--ui-text)] group-hover:opacity-100"
      :class="filename ? 'top-9' : 'top-2'"
      :aria-label="copied ? 'Copied' : 'Copy code'"
      @click="copy"
    >
      <Icon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3.5" />
    </button>

    <!-- Body: prefer highlighted HTML, then slot content, then raw code. -->
    <div v-if="highlighted" class="shiki-wrapper overflow-x-auto text-sm" v-html="highlighted" />
    <pre v-else-if="hasSlot" class="overflow-x-auto px-4 py-3 text-sm"><code><slot /></code></pre>
    <pre v-else class="overflow-x-auto px-4 py-3 text-sm"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
/*
 * Layout only. Dual-theme color/background switching for `.shiki` lives in the
 * global stylesheet (`assets/main.css`, keyed on `html.light`/`html.dark`) so it
 * applies to every highlighted block, not just those wrapped by `.prose-pre`.
 */
.prose-pre :deep(.shiki) {
  margin: 0;
  padding: 0.75rem 1rem;
}

/* Plain (non-highlighted) fallback code — match the `.shiki` block padding. */
.prose-pre :deep(pre) {
  margin: 0;
  padding: 0.75rem 1rem;
}
.prose-pre :deep(code) {
  font-family: var(--ui-font-mono, ui-monospace, monospace);
}

/*
 * Soft-wrap long lines instead of showing a horizontal scrollbar. `pre-wrap`
 * preserves indentation, `overflow-wrap: anywhere` breaks unbreakable tokens;
 * the body keeps `overflow-x-auto` so a scrollbar still appears only when a
 * token truly cannot wrap.
 */
.prose-pre :deep(.shiki),
.prose-pre :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
