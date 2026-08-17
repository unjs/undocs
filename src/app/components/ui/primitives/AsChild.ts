/**
 * Ported from reka-ui's `Slot`/`Primitive as-child` (MIT,
 * https://github.com/unovue/reka-ui). It grafts props onto one child without a
 * layout-changing wrapper. `cloneVNode(..., true)` must merge event handlers and
 * append refs so injected behavior does not replace a child's navigation or
 * measurement hooks.
 *
 * Dropped, and why:
 * - `Primitive`'s `as` mode: this helper is only for `as-child`; consumers can
 *   write their own wrapper.
 * - reka's error for non-single children: ambiguous slots render untouched so
 *   an absent tooltip trigger stays inert rather than crashing.
 */
import {
  Comment,
  Fragment,
  Text,
  cloneVNode,
  defineComponent,
  type PropType,
  type VNode,
} from "vue";

/** Return the slot's sole renderable vnode, if any. */
export function singleChild(nodes: VNode[]): VNode | undefined {
  // Forwarded slots can nest Fragments, so unwrap recursively.
  const flat: VNode[] = [];
  const flatten = (list: VNode[]) => {
    for (const node of list) {
      if (node.type === Fragment && Array.isArray(node.children)) flatten(node.children as VNode[]);
      else flat.push(node);
    }
  };
  flatten(nodes);
  const renderable = flat.filter(
    (node) =>
      node.type !== Comment &&
      !(node.type === Text && typeof node.children === "string" && !node.children.trim()),
  );
  return renderable.length === 1 ? renderable[0] : undefined;
}

export default defineComponent({
  name: "AsChild",
  inheritAttrs: false,
  props: {
    /** Appended to the child's ref; the caller may unwrap component `$el`. */
    elementRef: {
      type: Function as PropType<(element: unknown) => void>,
      default: undefined,
    },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const nodes = slots.default?.() ?? [];
      const child = singleChild(nodes);
      if (!child) return nodes;
      const extra = props.elementRef ? { ...attrs, ref: props.elementRef } : attrs;
      return cloneVNode(child, extra, true);
    };
  },
});
