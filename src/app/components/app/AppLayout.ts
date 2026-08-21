// `/` (and locale homes) choose layout from the content-derived landing flag.
import { computed, defineComponent, h } from "vue";
import { useRoute } from "@app/router.ts";
import { useLanding } from "@app/composables/useLanding.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { getLocaleFromPath, localeHomePath, resolveI18nConfig } from "@app/utils/locale.ts";
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
    const i18nConfig = resolveI18nConfig(useAppConfig().docs as { lang?: string; i18n?: any });
    const layoutName = computed(() => {
      const name = route.meta?.layout as string | undefined;
      if (name) return name;
      const locale = getLocaleFromPath(
        route.path,
        i18nConfig.localeCodes,
        i18nConfig.defaultLocale,
        i18nConfig.strategy,
      );
      const home = localeHomePath(locale, i18nConfig.defaultLocale, i18nConfig.strategy);
      return route.path === home && !landing.value ? "docs" : undefined;
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
