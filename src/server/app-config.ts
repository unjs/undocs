import { loadConfig } from "c12";
import { highlightCode } from "./content/highlight";

/**
 * Generate the client app-config from the docs project config (loaded via c12).
 *
 * This is the build-time source for the `virtual:undocs/app-config` module
 * (see `vite.config.ts`): the Vite virtual plugin calls this once, serializes
 * the result, and the client `useAppConfig()` composable merges it over the
 * undocs theme config (`src/app/app.config.ts`).
 *
 * Shape (consumed by the reused `app/` sources):
 *
 *   { docs, site: { name, description, url }, ui: { colors: { primary } } }
 *
 * It loads `<docsDir>/.config/docs.*` via c12, converts
 * `landing.features[].description` markdown → HTML (md4x), highlights
 * `landing.heroCode` via shiki (`contentHighlighted`), and infers `branch`
 * (default "main"). md4x/shiki are wrapped in try/catch so a highlight/markdown
 * failure degrades gracefully instead of failing the build.
 */
export interface UndocsAppConfig {
  docs: Record<string, any>;
  site: { name: string; description: string; url: string | undefined };
  ui: { colors: { primary: string } };
}

export async function generateAppConfig(docsDir: string): Promise<UndocsAppConfig> {
  const { config: docs } = await loadConfig<any>({ name: "docs", cwd: docsDir });

  // Guess branch (MVP: default to "main"; git/env inference is a later step).
  docs.branch = docs.branch || "main";

  // Convert markdown → HTML for landing feature descriptions. Uses md4x (the
  // same parser as the doc content) via its `md4x/wasm` entry.
  if (docs.landing && docs.landing.features) {
    try {
      const md4x = await import("md4x/wasm");
      await md4x.init();
      for (const item of docs.landing.features) {
        if (item.description) {
          item.description = md4x.renderToHtml(item.description);
        }
      }
    } catch (error) {
      console.error("[undocs] failed to render landing feature markdown:", error);
    }
  }

  // Normalize and syntax-highlight the hero code sample. Reuses the doc-content
  // highlighter (`highlightCode`) so the landing hero renders with the exact
  // same shiki instance, themes, and dual-theme (`--shiki-*`) output as every
  // other code block — no separate config that drifts out of sync.
  if (docs.landing && docs.landing.heroCode) {
    try {
      if (typeof docs.landing.heroCode === "string") {
        docs.landing.heroCode = { content: docs.landing.heroCode };
      }
      docs.landing.heroCode.contentHighlighted = (
        await highlightCode(docs.landing.heroCode.content, docs.landing.heroCode.lang || "sh")
      ).replaceAll(`<span class="line"></span>`, "");
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
        primary: docs.themeColor || "amber",
      },
    },
  };
}
