/**
 * User THEME layer glue.
 *
 * A docs project can ship a `.docs/components/**` dir whose Vue components are
 * discovered by the `undocs:user-theme` Vite plugin and exposed via the
 * `virtual:undocs/user-components` module. This registers them GLOBALLY on the
 * app so user pages/layouts can reference them by name without importing — the
 * stand-in for Nuxt's component auto-import. (The markdown renderer wires the
 * same map into its own tag→component registry separately; see
 * `content/MarkdownRenderer.ts`.)
 *
 * Both the PascalCase source name and its kebab-case form are registered so a
 * template can use either `<AppHero>` or `<app-hero>` regardless of how the file
 * was named. Called from `main.ts` (client) and `entry-server.ts` (SSR) with the
 * same app instance, so registration is identical across render and hydration.
 */
import type { App } from "vue";
import { kebabCase } from "scule";
import { components } from "virtual:undocs/user-components";

export function registerUserComponents(app: App): void {
  for (const [name, component] of Object.entries(components)) {
    app.component(name, component);
    const kebab = kebabCase(name);
    if (kebab !== name) app.component(kebab, component);
  }
}
