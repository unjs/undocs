import { loadDocsConfig } from "./docs-config.ts";
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
