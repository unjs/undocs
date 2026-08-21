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

export interface I18nLocaleConfig {
  code: string;
  iso?: string;
  displayName?: string;
  /** Optional chrome overrides (merged onto root `docs` via defu). */
  name?: string;
  shortDescription?: string;
  description?: string;
  landing?: DocsConfig["landing"];
  banner?: BannerProps;
  versions?: DocsConfig["versions"];
  /**
   * Nav overrides: full NavItem tree, or path → `{ title, hide }` patch map
   * applied on top of content-driven navigation.
   */
  navigation?: unknown;
}

export interface I18nConfig {
  /**
   * Locales for multilingual docs. Non-default locales live under
   * `docs/<code>/…` and are served at `/<code>/…` (`prefix_except_default`).
   * Powered by `@i18n-micro/vue` for UI chrome + locale switching.
   * Opt-in: without this array the site stays monolingual.
   */
  locales?: Array<string | I18nLocaleConfig>;
  /** Defaults to `docs.lang` or the first locale. */
  defaultLocale?: string;
  /**
   * URL strategy. `prefix_except_default` (default): `/guide` + `/ru/guide`.
   * `prefix` rewrites URLs only — content folders still follow
   * `prefix_except_default` (default locale at docs root) unless you also
   * prefix folders on disk.
   */
  strategy?: "prefix" | "prefix_except_default";
  /**
   * Directory (relative to docs root) for UI / MD translation JSON.
   * Defaults to `locales/`.
   */
  translationDir?: string;
}

export interface DocsConfig {
  dir?: string;
  /** Default HTML language / i18n default locale when `i18n` is unset. */
  lang?: string;
  /** Multilingual documentation (see `i18n`). */
  i18n?: I18nConfig;
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
   * `true` means `credentialless` — cross-origin subresources load without
   * credentials, so nothing upstream has to change. `"require-corp"` is the
   * stricter alternative, valid only when every cross-origin asset sends
   * `Cross-Origin-Resource-Policy`. Either way a cross-origin iframe must send
   * COEP of its own or it will not load.
   */
  crossOriginIsolation?: boolean | "credentialless" | "require-corp";
  automd?: unknown;
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
