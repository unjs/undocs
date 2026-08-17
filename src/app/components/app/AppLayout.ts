// `/` chooses its layout from the content-derived landing flag, unavailable
// when the router initially matches the route.
import { computed, defineComponent, h } from "vue";
import { useRoute } from "@app/router.ts";
import { useLanding } from "@app/composables/useLanding.ts";
import DocsLayout from "@app/layouts/docs.vue";
import BlogLayout from "@app/layouts/blog.vue";
import { layouts as userLayouts } from "virtual:undocs/user-layouts";

// User layouts intentionally override built-ins.
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
        return slots.default?.();
      }
      return h(layout, null, { default: () => slots.default?.() });
    };
  },
});
