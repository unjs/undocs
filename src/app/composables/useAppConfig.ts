/**
 * `useAppConfig` — the merged app-config singleton.
 *
 * Two static sources are merged once, at module load:
 *
 *   1. the docs project config (`virtual:undocs/app-config`), generated at build
 *      time from the user's `.config/docs.*` via c12 (see `vite.config.ts` /
 *      `src/server/app-config.ts`) — the "user provided" config, and
 *   2. the undocs theme config (`src/app/app.config.ts`).
 *
 * The user config wins over the theme (`defu(user, theme)`). Consumers read
 * `useAppConfig().docs` / `.site` / `.ui`:
 *
 *   - `.docs` — docs config (name, github, socials, banner, landing, ...)
 *   - `.site` — { name, description, url } (read by `usePageSEO`)
 *   - `.ui`   — theme UI config (`ui.colors`, `ui.prose.codeIcon`) + the
 *               runtime primary color (`ui.colors.primary`).
 */
import { defu } from "defu";
// The undocs theme config. It wraps its object in `defineAppConfig` (below).
import themeConfig from "@app/app.config.ts";
// The docs project config, generated from c12 and served as a vfs by the
// `undocs:app-config` Vite plugin.
import userConfig from "virtual:undocs/app-config";

/** Identity helper: `app.config.ts` wraps its object in `defineAppConfig`. */
export function defineAppConfig<T>(config: T): T {
  return config;
}

// Merge once. User (docs project) values win over the theme defaults; `defu`
// deep-merges so theme-only keys (e.g. `ui.prose.codeIcon`) survive.
const appConfig = defu(userConfig, themeConfig as Record<string, any>);

export function useAppConfig(): typeof appConfig {
  return appConfig;
}
