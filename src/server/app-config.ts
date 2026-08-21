import { loadDocsConfig } from "./docs-config.ts";
import { DOCS_ICON_ASSET, resolveDocsIcon } from "./docs-public.ts";
import { highlightCode } from "./content/highlight.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Build-time source for the virtual config; feature rendering and hero
// highlighting fail soft.

export interface UndocsAppConfig {
  docs: Record<string, any>;
  site: { name: string; description: string; url: string | undefined };
  ui: { colors: { primary: string } };
}

export type I18nRouteMessages = Record<string, Record<string, Record<string, unknown>>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Load root + page translation JSON without mutating roots.
 * Page files: `locales/pages/<a>/<b>/<code>.json` → route name `a-b`.
 */
function loadI18nMessages(
  docsDir: string,
  docs: Record<string, any>,
): {
  messages: Record<string, Record<string, unknown>>;
  routeMessages: I18nRouteMessages;
  pageRoutes: Record<string, string[]>;
} {
  const translationDir = resolve(docsDir, docs.i18n?.translationDir || "locales");
  const messages: Record<string, Record<string, unknown>> = {};
  const routeMessages: I18nRouteMessages = {};
  const pageRoutesByLocale: Record<string, Set<string>> = {};

  if (!existsSync(translationDir)) {
    return { messages, routeMessages, pageRoutes: {} };
  }

  for (const name of readdirSync(translationDir)) {
    if (!name.endsWith(".json")) continue;
    const code = name.slice(0, -5);
    try {
      const parsed = JSON.parse(readFileSync(join(translationDir, name), "utf8"));
      if (!isPlainObject(parsed)) {
        console.error(`[undocs] locales/${name} must be a JSON object`);
        continue;
      }
      messages[code] = parsed;
    } catch (error) {
      console.error(`[undocs] failed to parse locales/${name}:`, error);
    }
  }

  const pagesDir = join(translationDir, "pages");
  if (existsSync(pagesDir)) {
    const walk = (dir: string, prefix: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) {
          walk(full, prefix ? `${prefix}/${name.name}` : name.name);
          continue;
        }
        if (!name.name.endsWith(".json")) continue;
        // `pages/en.json` (locale at pages root) is not a page route — ignore.
        if (!prefix) {
          console.warn(
            `[undocs] ignoring locales/pages/${name.name} (expected pages/<route>/${name.name})`,
          );
          continue;
        }
        const code = name.name.slice(0, -5);
        const routeName = prefix
          .replace(/^\/+|\/+$/g, "")
          .split("/")
          .filter(Boolean)
          .join("-");
        try {
          const parsed = JSON.parse(readFileSync(full, "utf8"));
          if (!isPlainObject(parsed)) {
            console.error(`[undocs] ${full} must be a JSON object`);
            continue;
          }
          routeMessages[code] ||= {};
          routeMessages[code]![routeName] = parsed;
          pageRoutesByLocale[code] ||= new Set();
          pageRoutesByLocale[code]!.add(routeName);
        } catch (error) {
          console.error(`[undocs] failed to parse ${full}:`, error);
        }
      }
    };
    walk(pagesDir, "");
  }

  const pageRoutes: Record<string, string[]> = {};
  for (const [code, set] of Object.entries(pageRoutesByLocale)) {
    pageRoutes[code] = [...set];
  }

  return { messages, routeMessages, pageRoutes };
}

export async function generateAppConfig(docsDir: string): Promise<UndocsAppConfig> {
  const docs = await loadDocsConfig(docsDir);

  docs.branch = docs.branch || "main";

  // undocs ships no logo of its own, so a logo exists only when the docs project
  // drops an `icon.svg` into a public dir (`.docs/public` or `public`) or names
  // one in its config. Default to the detected file only then — otherwise `logo`
  // stays undefined and the header/footer/favicon render nothing rather than
  // someone else's mark. The value is a MARKER, not a URL: the file is a build
  // input, so the virtual-module plugin turns it into a Vite asset import and
  // the app gets a hashed (or inlined) URL instead of a raw `/icon.svg` fetch.
  if (!docs.logo && resolveDocsIcon(docsDir)) {
    docs.logo = DOCS_ICON_ASSET;
  }

  // Boolean `landing` is only an on/off switch.
  const landing = typeof docs.landing === "object" ? docs.landing : undefined;

  if (landing?.features) {
    try {
      const md4x = await import("md4x/wasm");
      await md4x.init();
      for (const item of landing.features) {
        if (item.description) {
          item.description = md4x.renderToHtml(item.description);
        }
      }
    } catch (error) {
      console.error("[undocs] failed to render landing feature markdown:", error);
    }
  }

  // Share the docs highlighter so hero grammar and token markup cannot drift.
  if (landing?.heroCode) {
    try {
      if (typeof landing.heroCode === "string") {
        landing.heroCode = { content: landing.heroCode };
      }
      landing.heroCode.contentHighlighted = highlightCode(
        landing.heroCode.content,
        landing.heroCode.lang || "sh",
      );
    } catch (error) {
      console.error("[undocs] failed to highlight hero code:", error);
    }
  }

  const {
    messages: i18nMessages,
    routeMessages: i18nRouteMessages,
    pageRoutes: i18nPageRoutes,
  } = loadI18nMessages(docsDir, docs);

  return {
    docs: {
      ...docs,
      dir: undefined,
      _i18nMessages: i18nMessages,
      _i18nRouteMessages: i18nRouteMessages,
      _i18nPageRoutes: i18nPageRoutes,
    },
    site: {
      name: docs.name || "",
      description: docs.description || "",
      url: docs.url,
    },
    ui: {
      colors: {
        // Match the mono accent seeded by tokens.css.
        primary: docs.themeColor || "mono",
      },
    },
  };
}
