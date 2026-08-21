/**
 * Frontmatter `i18n.disableMeta` → locale SEO opt-out (hreflang / og:locale).
 * `app.vue` provides; pages inject and set.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export const I18N_DISABLE_META_KEY: InjectionKey<Ref<boolean>> = Symbol.for(
  "undocs-i18n-disable-meta",
);

const orphanFallback = ref(false);

export function provideI18nDisableMeta(initial = false): Ref<boolean> {
  const disableMeta = ref(initial);
  provide(I18N_DISABLE_META_KEY, disableMeta);
  return disableMeta;
}

export function useI18nDisableMeta(): Ref<boolean> {
  return inject(I18N_DISABLE_META_KEY) ?? orphanFallback;
}
