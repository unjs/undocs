<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
/**
 * Tooltip — a label that appears next to whatever you wrap.
 *
 * Ported from reka-ui's `TooltipRoot`/`Trigger`/`Portal`/`Content` (MIT,
 * https://github.com/unovue/reka-ui). Reka spreads that over seven components
 * plus a Popper family, because a `TooltipContent` there has to be composable
 * with an arrow, a custom anchor, and content you can move the pointer INTO.
 * All six call sites here pass a string and an optional side, so the family
 * collapses to this one component sitting on four shared primitives:
 * `usePopper` (positioning), `usePresence` (exit animation), `AsChild` (the
 * trigger merge) and `useTooltipGroup` (the delay/skip-delay timers).
 *
 * The public prop API is unchanged — `text`, `kbds`, `delayDuration`, `side`,
 * `disabled`, `class` — and so are the classes on the content, so the rendered
 * result is the same tooltip.
 *
 * What is preserved exactly:
 *
 * - **The three-valued `data-state`.** `delayed-open` when the group was cold
 *   and the tooltip waited, `instant-open` when the group was already warm,
 *   `closed` otherwise. The classes below animate `delayed-open` and `closed`
 *   only, so sweeping across a row of icons after the first one has opened is
 *   deliberately instant and un-animated. That is reka's behaviour with these
 *   classes, and losing the distinction would make the sweep look sluggish.
 * - **The full trigger event set**, including the two non-obvious ones:
 *   `pointerdown` closes and latches `isPointerDown`, so the `focus` that
 *   follows a mouse click does NOT re-open the tooltip you just clicked
 *   through; and `pointermove` (not `pointerenter`) opens, because moving from
 *   a trigger onto an overlapping sibling fires no fresh `enter`.
 * - **`aria-describedby`** while open, wired with Vue 3.5's `useId()` — which is
 *   SSR-stable and request-scoped, NOT reka's module-level counter fallback
 *   (see AGENTS.md on per-request state).
 * - The two-element popper shape (positioned wrapper > styled content), which
 *   `usePopper` explains: the content owns the zoom keyframes, so it cannot also
 *   own the position transform.
 *
 * Dropped, with reasons:
 *
 * - **Hoverable content** (`TooltipContentHoverable` + `useGraceArea`): reka
 *   keeps a tooltip open while the pointer travels through a polygon between
 *   trigger and content, so you can reach into the tooltip. Nothing in ours is
 *   reachable — they hold a label and, at most, a `<kbd>` — so the tooltip now
 *   closes when the pointer leaves the trigger, which is reka's own
 *   `disableHoverableContent` behaviour. That also removes the shared
 *   `isPointerInTransitRef` that reka MUTATES on the provider context from
 *   whichever content mounted last, which is precisely the kind of cross-render
 *   shared state we are trying not to have.
 * - **The `VisuallyHidden` duplicate of the content.** reka renders the visible
 *   content, then a second hidden `<span role="tooltip">` holding the same text,
 *   and points `aria-describedby` at the copy. Here the id and `role="tooltip"`
 *   sit on the visible element, which is the ARIA authoring-practices shape and
 *   makes the description resolve to the thing that is actually on screen.
 * - `TooltipArrow` (no call site draws one), `forceMount`, `defaultOpen`,
 *   `v-model:open`, `ignoreNonKeyboardFocus`, `disableClosingTrigger` and
 *   `ariaLabel` — none are passed anywhere, and each only selects a non-default
 *   branch.
 */
import { computed, onMounted, ref, useId, watch, type ComponentPublicInstance } from "vue";
import AsChild from "./primitives/AsChild.ts";
import { useDismissableLayer } from "./primitives/useDismissableLayer.ts";
import { usePopper } from "./primitives/usePopper.ts";
import { usePresence } from "./primitives/usePresence.ts";
import { useTooltipGroup } from "./primitives/useTooltipGroup.ts";

const props = withDefaults(
  defineProps<{
    text?: string;
    kbds?: string[];
    delayDuration?: number;
    side?: "top" | "right" | "bottom" | "left";
    disabled?: boolean;
    class?: unknown;
  }>(),
  {
    delayDuration: 300,
    side: "top",
  },
);

const group = useTooltipGroup();
const contentId = useId();

const open = ref(false);
// True when this open had to wait out `delayDuration` — the only input to the
// `delayed-open` / `instant-open` split.
const wasOpenDelayed = ref(false);
const state = computed(() =>
  open.value ? (wasOpenDelayed.value ? "delayed-open" : "instant-open") : "closed",
);

const triggerEl = ref<HTMLElement | null>(null);
const wrapperEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

// The trigger can be a plain element or a component (`<Button>`); take the
// element either way, and ignore a fragment root's text anchor.
function setTriggerEl(element: unknown) {
  const resolved =
    element instanceof HTMLElement
      ? element
      : ((element as ComponentPublicInstance | null)?.$el as unknown);
  triggerEl.value = resolved instanceof HTMLElement ? resolved : null;
}

let openTimer: ReturnType<typeof setTimeout> | undefined;

function handleOpen() {
  clearTimeout(openTimer);
  wasOpenDelayed.value = false;
  open.value = true;
}

function handleClose() {
  clearTimeout(openTimer);
  open.value = false;
}

function handleDelayedOpen() {
  clearTimeout(openTimer);
  openTimer = setTimeout(() => {
    wasOpenDelayed.value = true;
    open.value = true;
  }, props.delayDuration);
}

// Warm the group on open, start its grace period on close — and let it close
// this tooltip if another one opens.
watch(open, (isOpen) => {
  if (isOpen) group.onOpen(handleClose);
  else group.onClose(handleClose);
});

// A `focus` fired by a mouse click must not re-open what the click just closed.
let isPointerDown = false;
// `pointermove` fires continuously; only the first one inside the trigger opens.
let hasPointerMoveOpened = false;

function handlePointerUp() {
  // One tick late, so the `focus` that follows the click still sees the latch.
  setTimeout(() => {
    isPointerDown = false;
  }, 1);
}

function handlePointerDown() {
  handleClose();
  isPointerDown = true;
  document.addEventListener("pointerup", handlePointerUp, { once: true });
}

function handlePointerMove(event: PointerEvent) {
  // A touch "hover" is a tap; opening on it would fight the tap's own action.
  if (event.pointerType === "touch" || hasPointerMoveOpened) return;
  if (group.isOpenDelayed()) handleDelayedOpen();
  else handleOpen();
  hasPointerMoveOpened = true;
}

function handlePointerLeave() {
  handleClose();
  hasPointerMoveOpened = false;
}

function handleFocus() {
  if (isPointerDown) return;
  handleOpen();
}

const triggerProps = computed(() => ({
  "aria-describedby": open.value ? contentId : undefined,
  "data-state": state.value,
  ...(props.disabled
    ? {}
    : {
        onPointermove: handlePointerMove,
        onPointerleave: handlePointerLeave,
        onPointerdown: handlePointerDown,
        onFocus: handleFocus,
        onBlur: handleClose,
        onClick: handleClose,
      }),
}));

// The portal is client-only; the same hydration-parity gate `Dialog.vue` uses.
const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const { shouldRender } = usePresence(open, contentEl);

const { wrapperStyle, contentStyle, placedSide, placedAlign } = usePopper({
  anchor: triggerEl,
  wrapper: wrapperEl,
  content: contentEl,
  side: () => props.side,
  sideOffset: 6,
});

// Scrolling the container the trigger sits in dismisses the tooltip instead of
// letting `autoUpdate` drag it along behind a moving anchor. Capture phase,
// because element scrolls do not bubble. (reka registers the same listener, but
// from inside `onMounted` with no effect scope around it, so it is never
// removed; keying it to the content element cleans up with the tooltip.)
watch(
  contentEl,
  (element, _previous, onCleanup) => {
    if (!element) return;
    const onScroll = (event: Event) => {
      const target = event.target;
      const trigger = triggerEl.value;
      if (trigger && target instanceof Node && target.contains(trigger)) handleClose();
    };
    window.addEventListener("scroll", onScroll, { capture: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll, { capture: true }));
  },
  { flush: "post" },
);

const { layerProps } = useDismissableLayer({
  element: contentEl,
  // Non-modal: nothing outside a tooltip is inerted, so `pointer-events` on the
  // body are left alone.
  onFocusOutside: () => false,
  onDismiss: handleClose,
});
</script>

<template>
  <AsChild :element-ref="setTriggerEl" v-bind="triggerProps">
    <slot />
  </AsChild>
  <Teleport v-if="isMounted" to="body">
    <div v-if="shouldRender" ref="wrapperEl" :style="wrapperStyle">
      <div
        :id="contentId"
        ref="contentEl"
        role="tooltip"
        :data-state="state"
        :data-side="placedSide"
        :data-align="placedAlign"
        :style="contentStyle"
        :class="
          cn(
            'z-50 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-tooltip',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
            'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
            props.class,
          )
        "
        v-bind="layerProps"
      >
        <slot name="text">{{ text }}</slot>
        <span v-if="kbds?.length" class="flex items-center gap-0.5">
          <kbd
            v-for="kbd in kbds"
            :key="kbd"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted px-1 font-mono text-[10px] uppercase text-muted-foreground"
          >
            {{ kbd }}
          </kbd>
        </span>
      </div>
    </div>
  </Teleport>
</template>
