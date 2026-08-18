import { loadDocsConfig } from "./docs-config.ts";
import { DOCS_ICON_ASSET, resolveDocsIcon } from "./docs-public.ts";
import { highlightCode } from "./content/highlight.ts";

// Build-time source for the virtual config; feature rendering and hero
// highlighting fail soft.

export interface UndocsAppConfig {
  docs: Record<string, any>;
  site: { name: string; description: string; url: string | undefined };
  ui: { colors: { primary: string } };
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

  return {
    docs: {
      ...docs,
      dir: undefined,
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
