/**
 * useDismissableLayer — "click outside or press Escape to close", with layering.
 *
 * Ported from reka-ui's `DismissableLayer` (MIT,
 * https://github.com/unovue/reka-ui). The hard part is not detecting the
 * outside click; it is deciding WHICH open layer an outside click or an Escape
 * belongs to. Every layer registers itself in mount order in a module-level
 * stack, and:
 *
 * - Escape only dismisses the TOP layer, so a dropdown opened inside a dialog
 *   closes the dropdown and leaves the dialog standing. Without the stack both
 *   would close on one keypress.
 * - A pointerdown that lands inside a layer registered ABOVE this one is not
 *   "outside" (`isInsideLayer`), which is what stops a click on a menu from
 *   tearing down the dialog hosting it.
 *
 * Three details in here are load-bearing and non-obvious, all kept from reka:
 *
 * - The document listener is attached on a 0ms timer. If a layer is opened BY a
 *   pointerdown, that same event is still bubbling to the document; subscribing
 *   synchronously would have the layer immediately dismiss itself.
 * - Touch pointers defer to the following `click` event (~350ms later on mobile
 *   browsers) instead of acting on `pointerdown`, so a tap that turns into a
 *   scroll or a long-press never dismisses, and pointer-events are not
 *   re-enabled inside that window.
 * - `pointerdownCapture` on the layer itself marks the pointer as inside BEFORE
 *   the document handler runs, which is how a click on content that removes
 *   itself mid-gesture is still treated as inside.
 *
 * The module-level stacks are browser-only state: the whole registration path
 * returns early under `import.meta.server`, and layers are keyed by DOM
 * elements, which do not exist during SSR. So this is not the per-request
 * mutable state AGENTS.md forbids — on the server nothing is ever written.
 *
 * Differences from reka:
 *
 * - reka routes each outside interaction through a cancellable `CustomEvent`
 *   (`dismissableLayer.pointerDownOutside`) dispatched on the layer, so that a
 *   consumer can `preventDefault()` to veto the dismissal, and emits a paired
 *   `interactOutside`. We take plain callbacks that return `false` to veto —
 *   same expressive power, no synthetic event allocation per interaction, and no
 *   second callback that fires for both cases.
 * - `DismissableLayerBranch` (marking a subtree outside the layer's DOM as still
 *   "inside" for dismissal purposes — reka uses it for Toast viewports) is
 *   dropped; nothing here portals content out of its own layer.
 * - The lifecycle is driven by the element ref going non-null/null rather than
 *   by a separate `present` prop. Our layers are `v-if`-ed by `usePresence`, so
 *   the element ref IS the presence signal, and one source of truth cannot
 *   disagree with itself.
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

/** Return `false` from a handler to keep the layer open. */
export type DismissHandler<E extends Event> = (event: E) => boolean | void;

export interface DismissableLayerOptions {
  /** The layer's root element. Non-null exactly while the layer is rendered. */
  element: Ref<HTMLElement | null | undefined>;
  /** Make everything outside this layer pointer-inert (modal behaviour). */
  disableOutsidePointerEvents?: MaybeRefOrGetter<boolean>;
  onEscapeKeyDown?: DismissHandler<KeyboardEvent>;
  onPointerDownOutside?: DismissHandler<PointerEvent>;
  onFocusOutside?: DismissHandler<FocusEvent>;
  /** Called once an interaction has been accepted as a dismissal. */
  onDismiss?: () => void;
}

/** Bind with `v-bind` on the layer's root element. */
export interface DismissableLayerProps {
  "data-dismissable-layer": string;
  style?: { pointerEvents: "auto" | "none" };
  onFocusCapture: () => void;
  onBlurCapture: () => void;
  onPointerdownCapture: () => void;
}

/** Open layers, in mount order — the last one is the top. */
const layers: HTMLElement[] = [];
/** The subset of `layers` that asked for everything outside them to be inert. */
const inertingLayers: HTMLElement[] = [];
/** Bumped on every stack mutation, so `pointer-events` recomputes reactively. */
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

/**
 * Is `target` inside `layer`, or inside a layer nested within it? Compares
 * DOCUMENT order of `[data-dismissable-layer]` nodes rather than the stack,
 * because a nested layer is always a later node than its host — which holds even
 * when both are teleported to `<body>`.
 */
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

  /**
   * With `disableOutsidePointerEvents` the body is inert and each layer opts
   * itself back in — but only layers at or above the highest inerting one, so a
   * dialog underneath a modal menu stays inert.
   */
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
    // Read the version so the style tracks stack mutations.
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
      // Re-arm rather than trust the previous listener fired: a tap that became
      // a scroll never raises `click`, and the stale handler must not survive.
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
