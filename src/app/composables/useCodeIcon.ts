/**
 * `useCodeIcon` — resolve a code-block icon from the theme `ui.prose.codeIcon`
 * map (`app.config.ts`).
 *
 * Shared by `ProsePre` (filename bar) and `ProseCodeGroup` (tab bar) so both
 * resolve icons identically. Matching runs most- to least-specific:
 *
 *   1. an explicit `icon` (override),
 *   2. exact filename / basename — `package.json`, `nitro.config.ts`,
 *   3. dotfile-suffix keys — `.npmrc`, `.config`, `.env.example`,
 *   4. file extension — `ts`, `mjs`, `yml`,
 *   5. the language (e.g. a fenced ```ts block with no filename).
 *
 * Falls back to a generic file icon.
 */
import { useAppConfig } from "@app/composables/useAppConfig";

export function useCodeIcon(): (filename?: string, language?: string, icon?: string) => string {
  const codeIcon = (useAppConfig().ui?.prose?.codeIcon ?? {}) as Record<string, string>;
  const keys = Object.keys(codeIcon);

  return function resolveCodeIcon(filename, language, icon) {
    if (icon) return icon;
    const file = filename?.toLowerCase();
    if (file) {
      const base = file.split("/").pop() as string;
      // 1. exact filename / path or basename.
      for (const key of keys) {
        const k = key.toLowerCase();
        if (file === k || base === k) return codeIcon[key];
      }
      // 2. dotfile-suffix keys (`.npmrc`, `.config`, `.env.example`, ...).
      for (const key of keys) {
        const k = key.toLowerCase();
        if (k.startsWith(".") && (base.endsWith(k) || file.endsWith(k))) return codeIcon[key];
      }
      // 3. file extension (`ts`, `mjs`, `yml`, ...).
      const dot = base.lastIndexOf(".");
      const ext = dot > 0 ? base.slice(dot + 1) : "";
      if (ext && codeIcon[ext]) return codeIcon[ext];
    }
    // 4. language.
    if (language && codeIcon[language]) return codeIcon[language];
    return "i-lucide-file";
  };
}
