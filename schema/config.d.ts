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

/**
 * The docs assistant: a chat button beside the documentation, backed by
 * [agentak](https://agentak.dev).
 *
 * The library is fetched from a CDN the first time a reader OPENS the chat, so a
 * docs project installs nothing and a reader who never takes the button
 * downloads none of it. The assistant answers from the site's own WebMCP tools
 * (`webmcp`), so it reads the documentation before it answers rather than
 * answering from memory.
 */
export interface ChatConfig {
  /** The words on the button, which are also its accessible name. Default `"Ask AI"`. */
  label?: string;
  /** The suggestions offered by an empty chat. Default `["Summarize this page"]`. */
  prompts?: string[];
  /**
   * Instructions added to the built-in ones, for what the project knows about
   * itself. They follow the built-in text rather than replacing it.
   */
  prompt?: string;
  /**
   * Where the `agentak` modules are loaded from. Default
   * `"https://esm.sh/agentak"`; the `/pi` subpath is requested beside it. Pin a
   * version (`https://esm.sh/agentak@1.2.3`) or point at a copy you host.
   */
  cdn?: string;
}

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
   * Build a package and include its tarball with the site.
   *
   * Use `true` for the package one level above the docs directory. Use a string
   * for another path relative to the docs directory.
   *
   * In production builds, undocs runs the package's `build` script if it has
   * one, runs `npm pack`, and serves the tarball at `/latest.tgz`. This option
   * does nothing in dev.
   */
  pkg?: boolean | string;
  /**
   * Expose docs search/navigation to browser AI agents via WebMCP
   * (https://webmachinelearning.github.io/webmcp/). Enabled by default —
   * browsers without a native `document.modelContext` get a polyfill, so the
   * tools are reachable today. Set to `false` to opt out.
   */
  webmcp?: boolean;
  /**
   * An AI chat assistant beside the docs, answering from the site's own WebMCP
   * tools. Enabled by default — agentak is fetched from a CDN only when a reader
   * first opens the chat, so a reader who never takes the button downloads none
   * of it. Set to `false` to opt out, or pass an object to configure it. See
   * `ChatConfig`.
   */
  chat?: boolean | ChatConfig;
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
