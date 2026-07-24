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

export interface DocsConfig {
  dir?: string;
  name?: string;
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
  themeColor?: string;
  redirects?: Record<string, string>;
  automd?: unknown;
  buildCache?: boolean;
  sponsors?: { api: string };
  landing?:
    | false
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
