export interface BannerAction {
  label?: string;
  icon?: string;
  to?: string;
  target?: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "solid" | "outline" | "soft" | "subtle" | "ghost" | "link";
}

/** Props for the undocs `Banner` component. */
export interface BannerProps {
  /** A unique id saved to local storage to remember if the banner has been dismissed. Change this value to show the banner again. */
  id?: string;
  /** The icon displayed next to the title (e.g., 'i-lucide-info'). */
  icon?: string;
  /** The banner title text. */
  title?: string;
  /** Display a list of action buttons next to the title. */
  actions?: BannerAction[];
  /** Link destination URL or route path. */
  to?: string;
  /** Link target attribute. */
  target?: string;
  /** Banner color theme. */
  color?: "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";
  close?: boolean | { size?: string; color?: string; variant?: string };
  /** The icon displayed in the close button (e.g., 'i-lucide-x'). */
  closeIcon?: string;
  /** UI customization classes for banner components. */
  ui?: Record<string, unknown>;
}

/** Docs config plugin entry: package name or `{ package, options }`. */
export type PluginSpec = string | { package: string; options?: Record<string, unknown> };

export interface DocsConfig {
  dir?: string;
  /** The name of the documentation site. Defaults to the `name` of the closest `package.json` (searching upwards from the docs directory up to the repository root). */
  name?: string;
  /** The description of the documentation site. Defaults to the `description` of the closest `package.json` (searching upwards from the docs directory up to the repository root). */
  description?: string;
  shortDescription?: string;
  url?: string;
  github?: string;
  socials?: Record<string, string>;
  llms?: {
    full?: {
      title?: string;
      description?: string;
    };
  };
  branch?: string;
  banner?: BannerProps;
  versions?: { label: string; to: string; active?: boolean }[];
  /** The accent color of the documentation site, default `mono`: `mono` (no accent — the monochrome default), a Geist hue (blue, red, amber, green, teal, purple, pink), a Tailwind palette name mapped onto the nearest Geist hue, a neutral name as a synonym for `mono`, or any CSS color. Tints links, active navigation and icons; solid buttons stay monochrome. */
  themeColor?: string;
  redirects?: Record<string, string>;
  /**
   * Serve the site cross-origin isolated (`Cross-Origin-Opener-Policy: same-origin`
   * plus a `Cross-Origin-Embedder-Policy`), the precondition for `SharedArrayBuffer`
   * and wasm threads. Off by default.
   *
   * `true` / `"credentialless"` strips credentials from cross-origin **no-cors**
   * subresource requests (CORS fetches still need a normal CORS response).
   * `"require-corp"` is stricter and only safe when every cross-origin asset
   * sends `Cross-Origin-Resource-Policy` (or CORS). A cross-origin iframe must
   * opt in via its own COEP header or the `credentialless` iframe attribute.
   */
  crossOriginIsolation?: boolean | "credentialless" | "require-corp";
  automd?: unknown;
  /**
   * Undocs plugins (`@undocs/i18n`, local paths, …). Each package exports a
   * `./server` hook surface and an optional `./client` entry baked into
   * `virtual:undocs/plugins-client` at build time.
   */
  plugins?: PluginSpec[];
  buildCache?: boolean;
  /**
   * Expose docs search/navigation to browser AI agents via WebMCP
   * (https://webmachinelearning.github.io/webmcp/). Enabled by default —
   * browsers without a native `document.modelContext` get a polyfill, so the
   * tools are reachable today. Set to `false` to opt out.
   */
  webmcp?: boolean;
  sponsors?: { api: string };
  /**
   * The landing page shown at `/`.
   *
   * `true` forces the hero on, `false` forces it off — with it off, `/` is
   * served from the docs-root `index.md` (or `README.md`) as an ordinary page:
   * docs layout, left sidebar, and a `Home` entry in the navigation. Any
   * configuration here also turns it on.
   *
   * Left unset, it is inferred from the content: docs organised into sections
   * get a landing, flat docs use their root page as the home page, and docs with
   * no root page always get one (nothing else could serve `/`).
   */
  landing?:
    | boolean
    | {
        title?: string;
        description?: string;
        _heroMdTitle?: string;
        heroTitle?: string;
        heroSubtitle?: string;
        heroDescription?: string;
        heroLinks?: Record<
          string,
          string | { label?: string; icon?: string; to?: string; size?: string; order?: number }
        >;
        heroCode?: string | { content: string; title?: string; lang?: string };
        featuresTitle?: string;
        featuresLayout?: "default" | "hero";
        features?: { title: string; description?: string; icon?: string }[];
        contributors?: boolean;
      };
}
