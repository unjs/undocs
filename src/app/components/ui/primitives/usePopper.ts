/**
 * Ported from reka-ui's Radix-derived `PopperRoot`/`PopperAnchor`/
 * `PopperContent` (MIT, https://github.com/unovue/reka-ui). Floating UI retains
 * collision, clipping, zoom, and sub-pixel geometry; local watches replace its
 * Vue ref/style adapter. Position stays on a wrapper while animated transforms
 * stay on inner content so they cannot collide; content remains hidden until
 * first measurement. Geometry
 * is exposed as `--undocs-popper-*`. The viewport remains the collision boundary
 * so sidebar scroll containers do not spuriously flip tooltips. Layout work is
 * client-only; SSR returns initial styles without module state.
 *
 * Dropped, and why:
 * - `@floating-ui/vue`: local watches provide its small framework adapter while
 *   `@floating-ui/dom` keeps the difficult geometry.
 * - reka's per-component custom-property aliases: internal callers can use the
 *   shared popper names directly; geometry properties themselves remain.
 * - arrow middleware and `PopperArrow`: no undocs popper draws an arrow.
 * - `hideWhenDetached`, `prioritizePosition`, `memoDependencies`,
 *   `updatePositionStrategy: "always"`, and `disableUpdateOnLayoutShift`: no
 *   caller selects these non-default branches.
 * - `dir`/`useDirection`: the document is fixed LTR and no input reaches RTL.
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
  anchor: Ref<HTMLElement | null | undefined>;
  wrapper: Ref<HTMLElement | null | undefined>;
  content: Ref<HTMLElement | null | undefined>;
  side?: MaybeRefOrGetter<PopperSide>;
  sideOffset?: MaybeRefOrGetter<number>;
  align?: MaybeRefOrGetter<PopperAlign>;
  alignOffset?: MaybeRefOrGetter<number>;
  avoidCollisions?: MaybeRefOrGetter<boolean>;
  collisionPadding?: MaybeRefOrGetter<number>;
  /**
   * `"partial"` lets a shifted popper hang half off its anchor rather than
   * detach from it; `"always"` shifts without that limit. Default `"partial"`.
   */
  sticky?: MaybeRefOrGetter<"partial" | "always">;
  strategy?: Strategy;
}

export interface PopperReturn {
  wrapperStyle: ComputedRef<CSSProperties>;
  contentStyle: ComputedRef<CSSProperties>;
  placedSide: ComputedRef<PopperSide>;
  placedAlign: ComputedRef<PopperAlign>;
  isPositioned: Readonly<Ref<boolean>>;
  update: () => void;
}

export interface TransformOrigin {
  x: string;
  y: string;
}

export function splitPlacement(placement: Placement): [PopperSide, PopperAlign] {
  const [side, align = "center"] = placement.split("-");
  return [side as PopperSide, align as PopperAlign];
}

/** No-arrow animation origin, exported for DOM-free geometry tests. */
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

/* Pixel-grid snapping keeps transformed text crisp across device ratios. */
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
      // Prevent pre-measurement single-character wrapping.
      minWidth: "max-content",
      zIndex: contentZIndex.value,
      // Do not paint at 0,0 before measurement.
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

  // Delay enter keyframes until position is stable.
  const contentStyle = computed<CSSProperties>(() =>
    isPositioned.value ? {} : { animation: "none" },
  );

  const middleware = computed<Middleware[]>(() => {
    const avoidCollisions = toValue(options.avoidCollisions) ?? true;
    const overflowOptions = {
      padding: toValue(options.collisionPadding) ?? 0,
      // Empty boundaries preserve reka's viewport-only default.
      boundary: [] as Element[],
      altBoundary: false,
    };
    return [
      offset({
        mainAxis: toValue(options.sideOffset) ?? 0,
        alignmentAxis: toValue(options.alignOffset) ?? 0,
      }),
      // Shift before flip so minor overflow does not needlessly swap sides.
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

  // Ignore stale async measurements that resolve after newer options.
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
      // Copy z-index to the positioned wrapper's stacking context.
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
      // Observe scroll, resize, layout shift, and element resize.
      onCleanup(autoUpdate(reference, floating, update));
    },
    { immediate: true, flush: "post" },
  );

  watch([desiredPlacement, middleware], () => update(), { flush: "post" });

  return { wrapperStyle, contentStyle, placedSide, placedAlign, isPositioned, update };
}
