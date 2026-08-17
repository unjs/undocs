import { defineComponent, h, mergeProps } from "vue";
import { useRouter, type RouteTarget } from "@app/router.ts";

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

      const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = (attrs as any).target ?? props.target;
        if (target && target !== "_self") return;
        event.preventDefault();
        void router.push(to);
      };

      // mergeProps preserves handlers injected by AsChild/menu items.
      return h(
        "a",
        mergeProps({ href: href(to), onClick, target: props.target }, attrs),
        slots.default?.(),
      );
    };
  },
});
