// Resolve explicit, filename, dotfile-suffix, extension, then language icons.
import { useAppConfig } from "@app/composables/useAppConfig.ts";

export function useCodeIcon(): (filename?: string, language?: string, icon?: string) => string {
  const codeIcon = (useAppConfig().ui?.prose?.codeIcon ?? {}) as Record<string, string>;
  const keys = Object.keys(codeIcon);

  return function resolveCodeIcon(filename, language, icon) {
    if (icon) return icon;
    const file = filename?.toLowerCase();
    if (file) {
      const base = file.split("/").pop() as string;
      for (const key of keys) {
        const k = key.toLowerCase();
        if (file === k || base === k) return codeIcon[key];
      }
      for (const key of keys) {
        const k = key.toLowerCase();
        if (k.startsWith(".") && (base.endsWith(k) || file.endsWith(k))) return codeIcon[key];
      }
      const dot = base.lastIndexOf(".");
      const ext = dot > 0 ? base.slice(dot + 1) : "";
      if (ext && codeIcon[ext]) return codeIcon[ext];
    }
    if (language && codeIcon[language]) return codeIcon[language];
    return "i-lucide-file";
  };
}
