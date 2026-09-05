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

// Fails soft: a missing renderer leaves the snippets as they are.
async function loadMarkdown() {
  try {
    const md4x = await import("md4x/wasm");
    await md4x.init();
    return md4x;
  } catch (error) {
    console.error("[undocs] failed to load the markdown renderer:", error);
    return undefined;
  }
}

// The non-blank notes, or undefined when there is nothing to render.
function footerNotes(notes: unknown): string[] | undefined {
  const list = (Array.isArray(notes) ? notes : [notes])
    .filter((note): note is string => typeof note === "string" && note.trim() !== "")
    .map((note) => note.trim());
  return list.length > 0 ? list : undefined;
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

  // Markdown snippets in the config (feature descriptions, footer notes) are
  // rendered here, once, so the client never loads md4x. Loaded only when one
  // of them is present.
  const notes = footerNotes(docs.footer?.notes);
  if (docs.footer && !notes) {
    // Blank notes are no notes: the footer falls back to the name line.
    docs.footer.notes = undefined;
  }
  const md4x = landing?.features || notes ? await loadMarkdown() : undefined;

  if (landing?.features && md4x) {
    try {
      for (const item of landing.features) {
        if (item.description) {
          item.description = md4x.renderToHtml(item.description);
        }
      }
    } catch (error) {
      console.error("[undocs] failed to render landing feature markdown:", error);
    }
  }

  if (notes && md4x) {
    try {
      docs.footer.notes = notes.map((note) => md4x.renderToHtml(note));
    } catch (error) {
      console.error("[undocs] failed to render footer notes markdown:", error);
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
