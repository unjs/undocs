<!-- eslint-disable vue/no-v-html -->
<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import { computed, ref, useSlots } from "vue";
import { useCodeIcon } from "@app/composables/useCodeIcon.ts";
import { useUndocsT } from "@app/composables/useUndocsT.ts";

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
const { t } = useUndocsT();

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
    class="prose-pre group relative my-4 overflow-hidden rounded-lg border border-border bg-muted"
    :class="props.class"
  >
    <div
      v-if="filename"
      class="flex items-center gap-2 border-b border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground"
    >
      <Icon :name="fileIcon" class="size-3.5 shrink-0" />
      <span class="truncate">{{ filename }}</span>
    </div>

    <button
      type="button"
      class="absolute right-2 z-10 inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
      :class="filename ? 'top-9' : 'top-2'"
      :aria-label="copied ? t('copy.copied') : t('copy.code')"
      @click="copy"
    >
      <Icon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3.5" />
    </button>

    <div v-if="highlighted" class="code-hl-wrapper overflow-x-auto text-sm" v-html="highlighted" />
    <pre v-else-if="hasSlot" class="overflow-x-auto px-4 py-3 text-sm"><code><slot /></code></pre>
    <pre v-else class="overflow-x-auto px-4 py-3 text-sm"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
/*
 * Layout only. Dual-theme token coloring for `.code-hl` lives in the global
 * stylesheet (`assets/main.css`, keyed on `html.light`/`html.dark`) so it
 * applies to every highlighted block, not just those wrapped by `.prose-pre`.
 */
.prose-pre :deep(.code-hl) {
  margin: 0;
  padding: 0.75rem 1rem;
}

.prose-pre :deep(pre) {
  margin: 0;
  padding: 0.75rem 1rem;
}
.prose-pre :deep(code) {
  font-family: var(--font-mono, ui-monospace, monospace);
}

/*
 * Soft-wrap long lines instead of showing a horizontal scrollbar. `pre-wrap`
 * preserves indentation, `overflow-wrap: anywhere` breaks unbreakable tokens;
 * the body keeps `overflow-x-auto` so a scrollbar still appears only when a
 * token truly cannot wrap.
 */
.prose-pre :deep(.code-hl),
.prose-pre :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
