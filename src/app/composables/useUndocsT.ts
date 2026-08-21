/**
 * Thin `$t` for undocs chrome: uses `@i18n-micro/vue` when the plugin is
 * installed, otherwise returns the English shipped default (or the key).
 */
import { inject } from "vue";
import { I18nInjectionKey } from "@i18n-micro/vue";
import { uiMessages } from "@shared/i18n-messages.ts";

type I18nLike = {
  t: (key: string, params?: Record<string, string | number | boolean>) => string;
};

function lookupDefault(key: string, params?: Record<string, string | number | boolean>): string {
  const en = (uiMessages.en?.[key] as string | undefined) ?? key;
  if (!params) return en;
  return en.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function useUndocsT() {
  const i18n = inject<I18nLike | undefined>(I18nInjectionKey, undefined);

  function t(key: string, params?: Record<string, string | number | boolean>): string {
    if (!i18n) return lookupDefault(key, params);
    return i18n.t(key, params);
  }

  return { t, i18n };
}
