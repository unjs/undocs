/**
 * AppLink → the `<router-link>` equivalent, with a plain `<a>` for external
 * links. Internal links render an `<a href>` and intercept plain left-clicks to
 * navigate via the router (`router.push`) — modified clicks, non-`_self`
 * targets, and external/`mailto`/`tel`/`#` hrefs fall through to the browser.
 */
import { defineComponent, h, mergeProps } from "vue";
import { useRouter, type RouteTarget } from "@app/router";

const EXTERNAL_RE = /^(https?:)?\/\/|^(?:mailto|tel):|^#/;

function href(to: RouteTarget): string {
  return typeof to === "string" ? to : to.path + (to.hash ?? "");
}

export default defineComponent({
  name: "AppLink",
  inheritAttrs: false,
  props: {
    to: { type: [String, Object] as any, default: undefined },
    href: { type: String, default: undefined },
    target: { type: String, default: undefined },
    external: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const router = useRouter();

    return () => {
      const to = (props.to ?? props.href) as RouteTarget | undefined;
      const isExternal = props.external || (typeof to === "string" && EXTERNAL_RE.test(to));

      if (to == null) {
        return h("a", attrs, slots.default?.());
      }

      if (isExternal) {
        return h(
          "a",
          mergeProps(
            {
              href: to as string,
              target: props.target ?? "_blank",
              rel: props.target === "_blank" || !props.target ? "noopener noreferrer" : undefined,
            },
            attrs,
          ),
          slots.default?.(),
        );
      }

      // Internal link: real href for SSR / new-tab / SEO, intercepted for SPA nav.
      const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = (attrs as any).target ?? props.target;
        if (target && target !== "_self") return;
        event.preventDefault();
        void router.push(to);
      };

      // `mergeProps` (not `{ ...attrs }`) so our SPA-nav `onClick` is COMBINED with
      // any `onClick` a parent forwards via attrs (e.g. reka-ui's `NavigationMenuLink
      // as-child` injects its own click handler). A plain spread would let the
      // forwarded handler overwrite ours, and the link would fall back to a full
      // page load. Both handlers run; ours `preventDefault`s the browser navigation.
      return h(
        "a",
        mergeProps({ href: href(to), onClick, target: props.target }, attrs),
        slots.default?.(),
      );
    };
  },
});
