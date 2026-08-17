/**
 * Ported from reka-ui's `DismissableLayer` (MIT,
 * https://github.com/unovue/reka-ui). A browser-only mount-order stack assigns
 * Escape to the top layer and treats higher nested layers as inside; SSR returns
 * before stack writes. The document pointer listener starts on a timer so the
 * opening event cannot dismiss the layer. Touch waits for `click`, excluding
 * scrolls and long presses and retaining inertness through the delay; capture
 * records inside gestures even if their target disappears mid-event.
 *
 * Dropped, and why:
 * - cancellable outside/interact `CustomEvent`s: callbacks returning `false`
 *   preserve vetoes without synthetic allocation or a duplicate paired event.
 * - `DismissableLayerBranch`: no undocs layer portals a branch outside itself.
 * - separate `present`: the `usePresence`-controlled element ref is already the
 *   authoritative lifecycle signal.
 */
import {
  computed,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export type DismissHandler<E extends Event> = (event: E) => boolean | void;

export interface DismissableLayerOptions {
  element: Ref<HTMLElement | null | undefined>;
  disableOutsidePointerEvents?: MaybeRefOrGetter<boolean>;
  onEscapeKeyDown?: DismissHandler<KeyboardEvent>;
  onPointerDownOutside?: DismissHandler<PointerEvent>;
  onFocusOutside?: DismissHandler<FocusEvent>;
  onDismiss?: () => void;
}

export interface DismissableLayerProps {
  "data-dismissable-layer": string;
  style?: { pointerEvents: "auto" | "none" };
  onFocusCapture: () => void;
  onBlurCapture: () => void;
  onPointerdownCapture: () => void;
}

const layers: HTMLElement[] = [];
const inertingLayers: HTMLElement[] = [];
/* Makes pointer-event styles reactive to stack changes. */
const stackVersion = ref(0);
let originalBodyPointerEvents: string | undefined;

function pushLayer(stack: HTMLElement[], layer: HTMLElement) {
  stack.push(layer);
  stackVersion.value++;
}

function removeLayer(stack: HTMLElement[], layer: HTMLElement) {
  const index = stack.indexOf(layer);
  if (index !== -1) stack.splice(index, 1);
  stackVersion.value++;
}

/** DOM order identifies nested teleported layers when containment cannot. */
function isInsideLayer(layer: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const targetLayer = target.closest("[data-dismissable-layer]");
  if (!targetLayer) return false;
  if (layer === targetLayer) return true;
  const all = [...layer.ownerDocument.querySelectorAll("[data-dismissable-layer]")];
  return all.indexOf(layer) < all.indexOf(targetLayer);
}

export function useDismissableLayer(options: DismissableLayerOptions): {
  layerProps: ComputedRef<DismissableLayerProps>;
} {
  const { element } = options;

  let isPointerInside = false;
  let isFocusInside = false;
  let pendingTouchClick: (() => void) | undefined;

  /* Only layers at or above the highest modal layer opt back into pointer input. */
  const layerProps = computed<DismissableLayerProps>(() => {
    const props: DismissableLayerProps = {
      "data-dismissable-layer": "",
      onFocusCapture: () => {
        isFocusInside = true;
      },
      onBlurCapture: () => {
        isFocusInside = false;
      },
      onPointerdownCapture: () => {
        isPointerInside = true;
      },
    };
    void stackVersion.value;
    const highestInerting = inertingLayers.at(-1);
    if (!highestInerting || !element.value) return props;
    const index = layers.indexOf(element.value);
    props.style = {
      pointerEvents: index >= layers.indexOf(highestInerting) ? "auto" : "none",
    };
    return props;
  });

  if (import.meta.server) return { layerProps };

  const onTouchClick = () => {
    pendingTouchClick?.();
    pendingTouchClick = undefined;
  };

  const onPointerDown = (event: PointerEvent) => {
    const layer = element.value;
    if (!layer) return;

    if (isInsideLayer(layer, event.target)) {
      isPointerInside = false;
      return;
    }
    if (isPointerInside) {
      document.removeEventListener("click", onTouchClick);
      isPointerInside = false;
      return;
    }
    isPointerInside = false;

    const dismiss = () => {
      if (options.onPointerDownOutside?.(event) === false) return;
      options.onDismiss?.();
    };

    if (event.pointerType === "touch") {
      // A scrolled tap emits no click; discard its stale pending handler.
      document.removeEventListener("click", onTouchClick);
      pendingTouchClick = dismiss;
      document.addEventListener("click", onTouchClick, { once: true });
    } else {
      dismiss();
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    const layer = element.value;
    if (!layer || isFocusInside) return;
    if (isInsideLayer(layer, event.target)) return;
    if (options.onFocusOutside?.(event) === false) return;
    options.onDismiss?.();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || layers.at(-1) !== element.value) return;
    if (options.onEscapeKeyDown?.(event) === false || event.defaultPrevented) return;
    options.onDismiss?.();
  };

  watch(
    element,
    (layer, _previous, onCleanup) => {
      if (!layer) return;
      pushLayer(layers, layer);

      const timer = window.setTimeout(() => {
        document.addEventListener("pointerdown", onPointerDown);
      });
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("keydown", onKeyDown);

      onCleanup(() => {
        window.clearTimeout(timer);
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("click", onTouchClick);
        pendingTouchClick = undefined;
        removeLayer(layers, layer);
      });
    },
    { immediate: true, flush: "post" },
  );

  watch(
    [element, () => toValue(options.disableOutsidePointerEvents ?? false)],
    ([layer, disable], _previous, onCleanup) => {
      if (!layer || !disable) return;
      if (inertingLayers.length === 0) {
        originalBodyPointerEvents = document.body.style.pointerEvents;
        document.body.style.pointerEvents = "none";
      }
      pushLayer(inertingLayers, layer);
      onCleanup(() => {
        removeLayer(inertingLayers, layer);
        if (inertingLayers.length === 0 && originalBodyPointerEvents !== undefined) {
          document.body.style.pointerEvents = originalBodyPointerEvents;
          originalBodyPointerEvents = undefined;
        }
      });
    },
    { immediate: true, flush: "post" },
  );

  return { layerProps };
}
