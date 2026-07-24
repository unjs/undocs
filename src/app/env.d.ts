/**
 * Ambient types for Nitro's fullstack `?assets` virtual modules, consumed by
 * `entry-server.ts` (`import clientAssets from "./main.ts?assets=client"`).
 * The runtime shape is produced by `mergeAssets` in nitro's vite plugin.
 */
interface FullstackAssets {
  /** The entry module URL (hashed in prod), or `undefined` for non-entry imports. */
  entry?: string;
  js: { href: string }[];
  css: { href: string }[];
  merge: (...others: FullstackAssets[]) => FullstackAssets;
}

/**
 * `.vue` SFC shim. Bare `tsc` (the `typecheck` script) can't resolve SFC imports;
 * this types them as a generic component so `tsc --noEmit` passes. It does NOT
 * type-check inside/across SFCs — that needs `vue-tsc`, which has no native-TS
 * (tsgo) build yet, so the shim is the pragmatic stand-in.
 */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
  export default component;
}

declare module "*?assets" {
  const assets: FullstackAssets;
  export default assets;
}

declare module "*?assets=client" {
  const assets: FullstackAssets;
  export default assets;
}

/**
 * `virtual:undocs/app-config` — the client app-config vfs, provided by the
 * `undocs:app-config` plugin in `vite.config.ts` (generated from the docs
 * project config via c12). Merged over the theme config by `useAppConfig()`.
 */
declare module "virtual:undocs/app-config" {
  const config: {
    docs: Record<string, any>;
    site: { name: string; description: string; url?: string };
    ui: {
      colors: { primary: string };
      prose?: { codeIcon?: Record<string, string> };
    };
  };
  export default config;
}

/**
 * `virtual:undocs/builtin-icons` — undocs' own icons, extracted from local
 * `@iconify-json/*` packages by the `undocs:builtin-icons` plugin. A flat
 * `collection:name` → Iconify icon data map, seeded into Iconify storage on both
 * server and client (see `builtin-icons.ts` / `ssr/icons.ts`).
 */
declare module "virtual:undocs/builtin-icons" {
  import type { IconifyIcon } from "@iconify/vue";
  const icons: Record<string, IconifyIcon>;
  export default icons;
}

/**
 * `virtual:undocs/user-*` — the user THEME layer, provided by the
 * `undocs:user-theme` plugin (globs `<docsDir>/.docs/{components,pages,layouts}`).
 * See `vite.plugins.ts` (`undocsUserTheme`).
 */
declare module "virtual:undocs/user-components" {
  import type { Component } from "vue";
  /** Component name (source basename) → component. */
  export const components: Record<string, Component>;
  const _default: Record<string, Component>;
  export default _default;
}

declare module "virtual:undocs/user-layouts" {
  import type { Component } from "vue";
  /** Layout name (lower-cased basename) → layout component. */
  export const layouts: Record<string, Component>;
  const _default: Record<string, Component>;
  export default _default;
}

declare module "virtual:undocs/user-pages" {
  import type { Component } from "vue";
  interface UserPageRoute {
    /** `RegExp` source string tested against `route.path`. */
    match: string;
    meta: Record<string, unknown>;
    component: () => Promise<{ default: Component } | Component>;
  }
  export const pages: UserPageRoute[];
  const _default: UserPageRoute[];
  export default _default;
}

/**
 * `mermaid`'s minified ESM deep-import ships no `.d.ts`. Re-export the package's
 * own types (`useMermaid` code-splits behind this path to keep it out of the
 * main chunk — see `composables/useMermaid.ts`).
 */
declare module "mermaid/dist/mermaid.esm.min.mjs" {
  export { default } from "mermaid";
}

/**
 * `import.meta` build flags. Statically replaced per Vite
 * environment (`define` in `vite.config.ts`): `server`/`client` distinguish the
 * SSR render env from the browser bundle; `dev`/`prerender` mirror the run mode.
 * Because they are compile-time constants, `if (import.meta.server) { … }`
 * branches are dead-code-eliminated from the opposite bundle.
 */
interface ImportMeta {
  readonly server: boolean;
  readonly client: boolean;
  readonly dev: boolean;
  readonly prerender: boolean;
}
