/**
 * AsChild — render nothing of your own; put your props on the child instead.
 *
 * Ported from reka-ui's `Slot`/`Primitive as-child` (MIT,
 * https://github.com/unovue/reka-ui). It is the mechanism behind every
 * `<TooltipTrigger as-child>` in this codebase: the tooltip needs to attach
 * `pointermove`/`focus`/`aria-describedby` to whatever the consumer already
 * wrote — `DocsToc`'s `<a>`, `DocsNavigation`'s `<span>`, `SocialButtons`'s
 * `<Button>` — without wrapping it in a `<span>` that would break the flex and
 * truncation layouts those live inside.
 *
 * Two details make it work rather than merely look like it works:
 *
 * - `cloneVNode` merges through `mergeProps`, which CHAINS event handlers
 *   instead of overwriting them. So a trigger that already has `@click` keeps
 *   it and gains ours. This is the same contract `AppLink` relies on at the
 *   other end (see the `mergeProps` note in `AppLink.ts`): an injected
 *   `onClick` arriving through attrs must combine with the link's own SPA-nav
 *   handler, never replace it.
 * - `mergeRef` is passed, so a `ref` we add is APPENDED to the child's own
 *   rather than replacing it. Both `DocsToc` and `DocsNavigation` measure their
 *   trigger elements through a `:ref` callback to decide whether the label is
 *   truncated — and that is precisely the ref that decides whether the tooltip
 *   is enabled at all. Dropping it would disable every tooltip it feeds.
 *
 * Differences from reka: reka's `Primitive` also handles the `as` prop (render a
 * real tag when NOT `as-child`), and throws when handed anything other than one
 * element. Here `as-child` is the only mode — a consumer that wants a wrapper
 * element writes one — and an ambiguous slot renders untouched instead of
 * throwing.
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

/**
 * The single renderable vnode in a slot's output, or `undefined` if the slot
 * rendered nothing, only comments (`v-if` off), or more than one element.
 */
export function singleChild(nodes: VNode[]): VNode | undefined {
  // `<slot/>` compiles to a Fragment, and a slot forwarded through another slot
  // nests them — so the unwrap has to recurse, not just peel one layer.
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
    /**
     * Attached to the child IN ADDITION to any ref it already carries. A
     * function rather than a ref object so the caller can unwrap a component
     * instance to its `$el` itself.
     */
    elementRef: {
      type: Function as PropType<(element: unknown) => void>,
      default: undefined,
    },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const nodes = slots.default?.() ?? [];
      const child = singleChild(nodes);
      // Nothing to graft onto — render the slot untouched rather than throw the
      // way reka's Slot does. A tooltip without a trigger is inert, not broken.
      if (!child) return nodes;
      const extra = props.elementRef ? { ...attrs, ref: props.elementRef } : attrs;
      return cloneVNode(child, extra, true);
    };
  },
});
