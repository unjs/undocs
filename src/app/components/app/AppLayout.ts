/**
 * AppLayout → layout resolver driven by the current route's `meta.layout`.
 *
 * `src/app/router.ts` encodes each page's layout as route `meta.layout`. This
 * component reads that (reactively) and renders the matching layout, passing its
 * own slot content through as the layout's default slot. A falsy/unknown layout
 * renders the slot directly (default passthrough).
 *
 * `/` is the one route whose layout is NOT in `meta`: with the landing off it is
 * an ordinary docs page and wants the docs layout (sidebar and all), and that
 * depends on the content tree, which the router cannot see when it matches the
 * route. See `useLanding` and `pages/index.vue`.
 */
import { computed, defineComponent, h } from "vue";
import { useRoute } from "@app/router.ts";
import { useLanding } from "@app/composables/useLanding.ts";
import DocsLayout from "@app/layouts/docs.vue";
import BlogLayout from "@app/layouts/blog.vue";
import { layouts as userLayouts } from "virtual:undocs/user-layouts";

// Built-in layouts plus user `.docs/layouts/**` (via the `undocs:user-theme`
// plugin), keyed by lower-cased name to match a page's `meta.layout`. User
// layouts spread last so a docs project can override `docs`/`blog` too.
const layouts: Record<string, any> = {
  docs: DocsLayout,
  blog: BlogLayout,
  ...userLayouts,
};

export default defineComponent({
  name: "AppLayout",
  inheritAttrs: false,
  setup(_props, { slots }) {
    const route = useRoute();
    const landing = useLanding();
    const layoutName = computed(() => {
      const name = route.meta?.layout as string | undefined;
      if (name) return name;
      return route.path === "/" && !landing.value ? "docs" : undefined;
    });
    return () => {
      const name = layoutName.value;
      const layout = name ? layouts[name] : undefined;
      if (!layout) {
        // Default layout = passthrough.
        return slots.default?.();
      }
      return h(layout, null, { default: () => slots.default?.() });
    };
  },
});
