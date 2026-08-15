/**
 * usePopper — anchor a floating element to a trigger, and keep it on screen.
 *
 * Ported from reka-ui's `PopperRoot`/`PopperAnchor`/`PopperContent` (MIT,
 * https://github.com/unovue/reka-ui), which is a Vue port of Radix's Popper,
 * which is itself a thin arrangement of `@floating-ui`. The arrangement is the
 * part worth owning; the numerical core is not. So this keeps the direct
 * dependency on **`@floating-ui/dom`** — the framework-agnostic 10KB package —
 * and drops `@floating-ui/vue`, whose entire contribution is turning refs into
 * an `autoUpdate` subscription and an x/y pair into a style object. That shim is
 * the `update()`/`watch` pair below, about forty lines, and owning it is the
 * point of the exercise. Collision detection, `flip`, `shift` and `size` are
 * not: they are geometry against scroll containers, clipping ancestors, zoom and
 * sub-pixel device ratios, and a hand-roll of them would be wrong in ways that
 * only show up on somebody else's monitor.
 *
 * `@floating-ui/dom` was already in the tree as reka's transitive dependency,
 * but pnpm's strict layout means it is NOT resolvable from `src/` — so this
 * genuinely trades one direct dependency for another rather than getting one for
 * free. The trade is: reka-ui (~30 primitives, one of which we use) for
 * `@floating-ui/dom` (one job, no framework).
 *
 * ## What it renders into
 *
 * Two elements, exactly as reka's `PopperContent` does, because the split is
 * load-bearing:
 *
 * - the **wrapper**, which is what actually gets positioned (`position: fixed`
 *   at `0,0` plus a `transform`). Nothing else may touch its transform.
 * - the **content** inside it, which carries the visible classes and — crucially
 *   — the enter/exit keyframes. Those keyframes animate `transform`, so if the
 *   position lived on the same element the animation would fight it and the
 *   tooltip would fly in from the top-left corner of the viewport.
 *
 * The content is also held at `animation: none` until the first measurement
 * lands (`contentStyle`), and the wrapper parks at `translate(0, -200%)` until
 * then, so nothing is ever painted at an unpositioned 0,0.
 *
 * ## Custom properties
 *
 * reka publishes `--reka-popper-{transform-origin,available-width,
 * available-height,anchor-width,anchor-height}` on the wrapper, and each of its
 * components re-exports them under its own prefix (`--reka-tooltip-trigger-width`
 * and friends). Nothing in `src/`, `test/` or `template/` referenced ANY of them
 * — checked by grep before this was written — so the names were free to change,
 * and they are now `--undocs-popper-*`. The per-component aliases are dropped
 * outright: they existed so a stranger styling a reka `TooltipContent` would not
 * have to know it was a Popper underneath, and we are not strangers here.
 *
 * The properties are still published, even unused, because they are the only way
 * a class can react to the geometry: `max-h-(--undocs-popper-available-height)`
 * on a long menu, or `min-w-(--undocs-popper-anchor-width)` to size a dropdown to
 * its trigger. They cost one `setProperty` per reposition.
 *
 * ## Differences from reka
 *
 * - The `arrow` middleware and `PopperArrow` are gone — no popper in undocs
 *   draws a callout arrow. That collapses `transformOrigin` to its no-arrow
 *   branch (reka computes an arrow-relative origin, then throws it away when
 *   `middlewareData.arrow` is absent, which for us is always).
 * - `hideWhenDetached`, `prioritizePosition`, `memoDependencies`,
 *   `updatePositionStrategy: "always"` and `disableUpdateOnLayoutShift` are
 *   dropped: all four are reka props that no call site here passes, and each
 *   only selects a non-default branch.
 * - `dir` is dropped along with reka's `useDirection`. The document declares
 *   `dir="ltr"` on `<html>` in `entry-server.ts` and nothing here is
 *   direction-aware, so the `rtl` swap in `transformOrigin` has no reachable
 *   input.
 * - The collision boundary is the VIEWPORT, hardcoded. reka's default
 *   `collisionBoundary: []` reaches floating-ui as an empty element list, whose
 *   only remaining clipper is the root boundary — so this is that default,
 *   stated rather than derived. It matters for the sidebar tooltips: a scroll
 *   container is deliberately NOT a collision boundary, or every tooltip in
 *   `DocsNavigation` would flip as soon as it neared the nav's own edge.
 *
 * Everything is client-only: `computePosition` and `autoUpdate` need a real
 * layout, and every consumer gates its floating element behind `isMounted`
 * anyway. Under `import.meta.server` the composable returns its initial styles
 * and never subscribes.
 */
import {
  autoUpdate,
  computePosition,
  flip,
  limitShift,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
  type Strategy,
} from "@floating-ui/dom";
import {
  computed,
  ref,
  toValue,
  watch,
  type CSSProperties,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export type PopperSide = "top" | "right" | "bottom" | "left";
export type PopperAlign = "start" | "center" | "end";

export interface PopperOptions {
  /** The element the floating layer is anchored to (the trigger). */
  anchor: Ref<HTMLElement | null | undefined>;
  /** The positioned wrapper. Owns `transform`; carries no visible styling. */
  wrapper: Ref<HTMLElement | null | undefined>;
  /** The styled element inside the wrapper. Only read for its `z-index`. */
  content: Ref<HTMLElement | null | undefined>;
  /** Preferred side of the anchor. Collision may flip it. Default `"top"`. */
  side?: MaybeRefOrGetter<PopperSide>;
  /** Gap between anchor and content, in px. Default `0`. */
  sideOffset?: MaybeRefOrGetter<number>;
  /** Alignment along the chosen side. Default `"center"`. */
  align?: MaybeRefOrGetter<PopperAlign>;
  /** Shift along the alignment axis, in px. Default `0`. */
  alignOffset?: MaybeRefOrGetter<number>;
  /** Flip/shift away from the viewport edges. Default `true`. */
  avoidCollisions?: MaybeRefOrGetter<boolean>;
  /** Keep-out margin from the viewport edges, in px. Default `0`. */
  collisionPadding?: MaybeRefOrGetter<number>;
  /**
   * `"partial"` lets a shifted popper hang half off its anchor rather than
   * detach from it; `"always"` shifts without that limit. Default `"partial"`.
   */
  sticky?: MaybeRefOrGetter<"partial" | "always">;
  /** CSS positioning strategy. Default `"fixed"`. */
  strategy?: Strategy;
}

export interface PopperReturn {
  /** Bind to the wrapper element's `style`. */
  wrapperStyle: ComputedRef<CSSProperties>;
  /** Bind to the content element's `style` (holds the enter animation back). */
  contentStyle: ComputedRef<CSSProperties>;
  /** The side actually used, after flipping — for `data-side`. */
  placedSide: ComputedRef<PopperSide>;
  /** The alignment actually used — for `data-align`. */
  placedAlign: ComputedRef<PopperAlign>;
  /** False until the first measurement has landed. */
  isPositioned: Readonly<Ref<boolean>>;
  /** Force a reposition (nothing here needs it; `autoUpdate` covers the rest). */
  update: () => void;
}

export interface TransformOrigin {
  x: string;
  y: string;
}

/** Split floating-ui's `"bottom-start"` into our `side`/`align` pair. */
export function splitPlacement(placement: Placement): [PopperSide, PopperAlign] {
  const [side, align = "center"] = placement.split("-");
  return [side as PopperSide, align as PopperAlign];
}

/**
 * Where a scale/zoom animation should grow FROM: the edge nearest the anchor.
 * reka's version divides an arrow's width in half to find the exact tip; with no
 * arrow the tip is the aligned corner or midpoint of the content, which is what
 * the percentage forms below say.
 *
 * Exported so the geometry can be pinned without a DOM (`test/app/popper.test.ts`);
 * everything else in here needs a real layout.
 */
export function transformOriginMiddleware(): Middleware {
  return {
    name: "transformOrigin",
    fn({ placement, rects }) {
      const [side, align] = splitPlacement(placement);
      const alongEdge = { start: "0%", center: "50%", end: "100%" }[align];
      switch (side) {
        case "bottom": {
          return { data: { x: alongEdge, y: "0px" } satisfies TransformOrigin };
        }
        case "top": {
          return {
            data: { x: alongEdge, y: `${rects.floating.height}px` } satisfies TransformOrigin,
          };
        }
        case "right": {
          return { data: { x: "0px", y: alongEdge } satisfies TransformOrigin };
        }
        default: {
          return {
            data: { x: `${rects.floating.width}px`, y: alongEdge } satisfies TransformOrigin,
          };
        }
      }
    },
  };
}

/**
 * Snap to the device pixel grid. A half-pixel `translate` on a text layer is the
 * difference between a crisp tooltip and a blurry one; floating-ui's own Vue
 * wrapper does exactly this, and `willChange` above 1.5x keeps the compositor
 * from re-rasterising the layer on every scroll.
 */
function roundByDPR(element: Element, value: number): number {
  const dpr = element.ownerDocument.defaultView?.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

export function usePopper(options: PopperOptions): PopperReturn {
  const { anchor, wrapper, content } = options;
  const strategy = options.strategy ?? "fixed";

  const desiredSide = computed(() => toValue(options.side) ?? "top");
  const desiredAlign = computed(() => toValue(options.align) ?? "center");
  const desiredPlacement = computed<Placement>(() =>
    desiredAlign.value === "center"
      ? desiredSide.value
      : (`${desiredSide.value}-${desiredAlign.value}` as Placement),
  );

  const x = ref(0);
  const y = ref(0);
  const isPositioned = ref(false);
  const placedPlacement = ref<Placement | undefined>();
  const transformOrigin = ref<TransformOrigin | undefined>();
  const contentZIndex = ref("");

  const placedSide = computed(
    () => splitPlacement(placedPlacement.value ?? desiredPlacement.value)[0],
  );
  const placedAlign = computed(
    () => splitPlacement(placedPlacement.value ?? desiredPlacement.value)[1],
  );

  const wrapperStyle = computed<CSSProperties>(() => {
    const element = wrapper.value;
    const style: CSSProperties = {
      position: strategy,
      left: "0",
      top: "0",
      // Without this the wrapper is a 0-width block at the viewport edge and the
      // content wraps to one character per line before it is ever positioned.
      minWidth: "max-content",
      zIndex: contentZIndex.value,
      // Park it off-screen rather than paint an unpositioned popper at 0,0.
      transform: "translate(0, -200%)",
    };
    if (!element || !isPositioned.value) return style;

    const dpr = element.ownerDocument.defaultView?.devicePixelRatio || 1;
    style.transform = `translate(${roundByDPR(element, x.value)}px, ${roundByDPR(element, y.value)}px)`;
    if (dpr >= 1.5) style.willChange = "transform";
    if (transformOrigin.value) {
      style["--undocs-popper-transform-origin"] =
        `${transformOrigin.value.x} ${transformOrigin.value.y}`;
    }
    return style;
  });

  // The enter keyframes must not run against a position that is about to change.
  const contentStyle = computed<CSSProperties>(() =>
    isPositioned.value ? {} : { animation: "none" },
  );

  const middleware = computed<Middleware[]>(() => {
    const avoidCollisions = toValue(options.avoidCollisions) ?? true;
    const overflowOptions = {
      padding: toValue(options.collisionPadding) ?? 0,
      // See the note above: an empty boundary list leaves the viewport as the
      // only clipper, which is reka's default and the behaviour we want.
      boundary: [] as Element[],
      altBoundary: false,
    };
    return [
      offset({
        mainAxis: toValue(options.sideOffset) ?? 0,
        alignmentAxis: toValue(options.alignOffset) ?? 0,
      }),
      // Order matters and is reka's: shift first so a popper that merely runs
      // off the edge slides back into view, and only flip when sliding was not
      // enough. Flipping first would swap sides for an overflow of one pixel.
      ...(avoidCollisions
        ? [
            shift({
              mainAxis: true,
              crossAxis: false,
              limiter:
                (toValue(options.sticky) ?? "partial") === "partial" ? limitShift() : undefined,
              ...overflowOptions,
            }),
            flip({ mainAxis: true, crossAxis: true, ...overflowOptions }),
          ]
        : []),
      size({
        ...overflowOptions,
        apply: ({ elements, rects, availableWidth, availableHeight }) => {
          const style = elements.floating.style;
          style.setProperty("--undocs-popper-available-width", `${availableWidth}px`);
          style.setProperty("--undocs-popper-available-height", `${availableHeight}px`);
          style.setProperty("--undocs-popper-anchor-width", `${rects.reference.width}px`);
          style.setProperty("--undocs-popper-anchor-height", `${rects.reference.height}px`);
        },
      }),
      transformOriginMiddleware(),
    ];
  });

  // A reposition is async (floating-ui's platform API is promise-based even
  // where the DOM answers synchronously), so a run that started before the
  // options changed can resolve after the one that replaced it. Only the newest
  // token may write.
  let token = 0;

  const update = () => {
    const reference = anchor.value;
    const floating = wrapper.value;
    if (!reference || !floating) return;
    const current = ++token;
    void computePosition(reference, floating, {
      strategy,
      placement: desiredPlacement.value,
      middleware: middleware.value,
    }).then((result) => {
      if (current !== token) return;
      x.value = result.x;
      y.value = result.y;
      placedPlacement.value = result.placement;
      transformOrigin.value = result.middlewareData.transformOrigin as TransformOrigin | undefined;
      isPositioned.value = true;
    });
  };

  if (import.meta.server) {
    return { wrapperStyle, contentStyle, placedSide, placedAlign, isPositioned, update };
  }

  watch(
    content,
    (element) => {
      // reka copies the content's own `z-index` onto the wrapper, because the
      // wrapper is `position: fixed` and therefore its own stacking context —
      // the content's `z-50` would otherwise only order it against its siblings
      // inside a wrapper that is itself at `z-index: auto`.
      if (element) contentZIndex.value = window.getComputedStyle(element).zIndex;
    },
    { immediate: true, flush: "post" },
  );

  watch(
    [anchor, wrapper],
    ([reference, floating], _previous, onCleanup) => {
      isPositioned.value = false;
      placedPlacement.value = undefined;
      if (!reference || !floating) return;
      // `autoUpdate` re-measures on scroll, resize, layout shift and element
      // resize — everything short of an rAF loop.
      onCleanup(autoUpdate(reference, floating, update));
    },
    { immediate: true, flush: "post" },
  );

  // `autoUpdate` only reacts to the DOM; a changed `side`/`offset` is ours.
  watch([desiredPlacement, middleware], () => update(), { flush: "post" });

  return { wrapperStyle, contentStyle, placedSide, placedAlign, isPositioned, update };
}
