<script setup lang="ts">
import { ref } from "vue";
import { useMermaid } from "@app/composables/useMermaid.ts";
import Skeleton from "@app/components/ui/Skeleton.vue";
import Button from "@app/components/ui/Button.vue";
import Dialog from "@app/components/ui/Dialog.vue";

const props = defineProps<{ code: string }>();
const svg = useMermaid(() => props.code);

const open = ref(false);

// Clicking the diagram opens the lightbox, but let real links (mermaid nodes
// can carry `<a xlink:href>`) and text selections through untouched.
const onDiagramClick = (e: MouseEvent, next: boolean) => {
  if ((e.target as Element)?.closest?.("a")) return;
  if (window.getSelection()?.toString()) return;
  open.value = next;
};
</script>

<template>
  <div v-if="svg" class="group relative">
    <div
      class="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    >
      <Button
        icon="i-lucide-expand"
        variant="outline"
        color="neutral"
        size="xs"
        square
        aria-label="View fullscreen"
        @click="open = true"
      />
    </div>
    <div class="mermaid overflow-auto">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        class="mermaid-svg cursor-zoom-in"
        v-html="svg"
        @click="onDiagramClick($event, true)"
      ></div>
    </div>

    <!-- The accessible name/description are `sr-only` inside `<Dialog>`; it owns
         the `aria-labelledby`/`aria-describedby` wiring. The close button used
         to be a `<DialogClose as-child>` around this same `<Button>`, which only
         ever merged an `onClick` onto it — so it carries the handler itself. -->
    <Dialog
      v-model:open="open"
      title="Diagram"
      description="Fullscreen view of the diagram."
      content-class="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
    >
      <Button
        icon="i-lucide-x"
        variant="outline"
        color="neutral"
        size="xs"
        square
        aria-label="Close"
        class="absolute right-2 top-2 z-10"
        @click="open = false"
      />
      <div class="mermaid mermaid-lightbox overflow-auto p-6">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="mermaid-svg cursor-zoom-out"
          v-html="svg"
          @click="onDiagramClick($event, false)"
        ></div>
      </div>
    </Dialog>
  </div>
  <div v-else>
    <div class="grid gap-2">
      <Skeleton class="h-4 w-[250px]" />
      <Skeleton class="h-4 w-[200px]" />
      <Skeleton class="h-4 w-[200px]" />
    </div>
  </div>
</template>

<style scoped>
.mermaid-svg :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

/* In the lightbox let the diagram fill the (fixed-width) dialog, growing past
   its intrinsic `max-width` so small diagrams scale up to fullscreen. */
.mermaid-lightbox .mermaid-svg :deep(svg) {
  width: 100%;
  max-width: none;
  max-height: 80vh;
}
</style>
