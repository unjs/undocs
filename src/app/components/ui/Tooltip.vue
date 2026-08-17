<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
/**
 * Ported from reka-ui Tooltip (MIT, https://github.com/unovue/reka-ui).
 * Preserves delayed/instant states, click-focus suppression, pointermove opening
 * for overlapping triggers, request-scoped ARIA ids, and separate positioning/
 * animation elements.
 *
 * Dropped, and why:
 * - hoverable content/grace area: local tooltips are labels, not interactive.
 * - hidden duplicate: the visible tooltip carries the ARIA id and role.
 * - arrow, mounting/controlled-open, and extra focus/close options: unused.
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
