<script setup lang="ts">
/**
 * Dialog — the modal shell: backdrop, centred panel, and the four behaviours
 * that separate a modal from an absolutely-positioned div.
 *
 * Ported from reka-ui's `DialogRoot`/`Portal`/`Overlay`/`Content`/`Title`/
 * `Description`/`Close` (MIT, https://github.com/unovue/reka-ui). Reka splits
 * that into eleven components because it has to be composable by strangers:
 * `DialogRoot` provides a context, `DialogContent` picks between a modal and a
 * non-modal implementation at runtime, and every leaf re-reads the context to
 * find the id it should carry. We have exactly two dialogs, both modal, both
 * with a screen-reader-only title and description, and neither uses
 * `DialogTrigger` (the diagram lightbox opens from a `<Button>`, the search
 * palette from a global shortcut). So the whole family collapses into this one
 * component, and the context disappears with it — ids are locals, not
 * `provide`/`inject`.
 *
 * What is preserved exactly:
 *
 * - `<Teleport to="body">` replaces `DialogPortal`, gated on `isMounted` the way
 *   reka's own `Teleport` wrapper is. The gate is a hydration-parity measure as
 *   much as a portal one: SSR renders the `v-if` comment, the client's first
 *   render renders the same comment, and the portal only appears on the patch
 *   after mount. (Both dialogs are closed on the server anyway, so nothing
 *   inside would render either way — but the teleport anchors would.)
 * - `DialogTitle`/`DialogDescription` were never anything but an `<h2>`/`<p>`
 *   carrying an id for `aria-labelledby`/`aria-describedby`. That wiring is
 *   reproduced with Vue 3.5's `useId()`, which is SSR-stable and request-scoped
 *   — NOT reka's module-level counter fallback, which would hand two concurrent
 *   SSR renders the same id (see AGENTS.md on per-request state). Both call
 *   sites want them for screen readers only, so `title`/`description` are plain
 *   props and the elements are `sr-only`: that class is the same clip-rect
 *   recipe reka's `<VisuallyHidden as-child>` merged as inline styles, minus the
 *   `aria-hidden="true"` its `feature="focusable"` default added — which is the
 *   more correct result for the very nodes `aria-labelledby` points at.
 * - `DialogClose` is gone: with `as-child` its entire contribution was merging
 *   an `onClick` onto the child, so the lightbox's close `<Button>` now carries
 *   `@click` itself. Identical DOM.
 * - The overlay keeps `pointer-events: auto` (the body is inert while the layer
 *   is up) and reka's `@pointerdown.left.self.prevent`, which stops a drag
 *   started on the backdrop from selecting text through the modal.
 * - The content keeps `tabindex="-1"`, which is not decoration: it is the target
 *   `useFocusScope` parks focus on when the panel has nothing tabbable inside.
 *
 * Dropped, with reasons: `modal={false}` and the entire `DialogContentNonModal`
 * branch (both dialogs are modal); `forceMount`/`unmountOnHide` (reka's escape
 * hatches for keeping hidden content in the DOM — with `unmountOnHide` left at
 * its default, reka passes a constant `present: true` down and the branch is
 * dead code for us anyway); and the dev-only `useWarning` that console.warns
 * about a missing title, which cannot happen when the title is a required prop.
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

// The portal only exists client-side; see the note above.
const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const overlayEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

// Two independent presences: the backdrop's fade and the panel's zoom are
// separate animations on separate elements, and each has to outlive `open` for
// exactly as long as its own keyframes run.
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
