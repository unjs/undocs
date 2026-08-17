<script setup lang="ts">
/**
 * Ported from reka-ui Dialog (MIT, https://github.com/unovue/reka-ui). Mounted
 * Teleport gating preserves hydration; `useId()` keeps ARIA ids request-scoped.
 * The overlay blocks backdrop drags, and `tabindex="-1"` gives the focus scope a
 * fallback target.
 *
 * Dropped, and why:
 * - context plus Trigger/Close leaves: both callers open externally and close
 *   directly, so local props and ids produce the same DOM.
 * - non-modal content: both dialogs are modal.
 * - `forceMount`/`unmountOnHide`: no caller keeps hidden content mounted.
 * - missing-title warning: `title` is required.
 */
import { onMounted, ref, useId } from "vue";
import { usePresence } from "./primitives/usePresence.ts";
import { useDismissableLayer } from "./primitives/useDismissableLayer.ts";
import { useFocusScope } from "./primitives/useFocusScope.ts";
import { useBodyScrollLock } from "./primitives/useBodyScrollLock.ts";
import { useHideOthers } from "./primitives/useHideOthers.ts";

const props = withDefaults(
  defineProps<{
    /** The dialog's accessible name. Rendered `sr-only`. */
    title: string;
    /** The dialog's accessible description. Rendered `sr-only`. */
    description?: string;
    overlayClass?: unknown;
    contentClass?: unknown;
  }>(),
  {
    overlayClass:
      "fixed inset-0 z-50 bg-[var(--overlay)]/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  },
);

const open = defineModel<boolean>("open", { default: false });

const titleId = useId();
const descriptionId = useId();

const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const overlayEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

// Backdrop and panel have independent exit animations.
const { shouldRender: renderOverlay } = usePresence(open, overlayEl);
const { shouldRender: renderContent } = usePresence(open, contentEl);

// Locked while the backdrop is up — including through its exit animation, so the
// page cannot scroll out from under a fading modal.
useBodyScrollLock(renderOverlay);

useHideOthers(contentEl);

const { layerProps } = useDismissableLayer({
  element: contentEl,
  disableOutsidePointerEvents: true,
  // A right-click (or ctrl-click, which is a right-click on macOS) opens a
  // context menu; dismissing under it would close the dialog behind the menu.
  onPointerDownOutside: (event) => !(event.button === 2 || (event.button === 0 && event.ctrlKey)),
  // Modal dialogs never dismiss on focus leaving — the focus scope is already
  // pulling it back, and letting both react turns a stray focus into a close.
  onFocusOutside: () => false,
  onDismiss: () => {
    open.value = false;
  },
});

const { onKeydown } = useFocusScope(contentEl, { trapped: open, loop: true });
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div
      v-if="renderOverlay"
      ref="overlayEl"
      :data-state="open ? 'open' : 'closed'"
      :class="props.overlayClass"
      style="pointer-events: auto"
      @pointerdown.left.self.prevent
    />
    <div
      v-if="renderContent"
      ref="contentEl"
      role="dialog"
      tabindex="-1"
      :aria-labelledby="titleId"
      :aria-describedby="description ? descriptionId : undefined"
      :data-state="open ? 'open' : 'closed'"
      :class="props.contentClass"
      v-bind="layerProps"
      @keydown="onKeydown"
    >
      <h2 :id="titleId" class="sr-only">{{ title }}</h2>
      <p v-if="description" :id="descriptionId" class="sr-only">{{ description }}</p>
      <slot />
    </div>
  </Teleport>
</template>
