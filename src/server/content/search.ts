// Tests: test/content/builder.test.ts, test/api.test.ts
// NODE-ONLY (pulls in md4x): builds the flat section list + serialized
// MiniSearch index for `/api/docs/search`. Client-safe MiniSearch
// options/`toSearchDocuments` live in `./search-options` so md4x stays
// out of the client bundle.
import * as md4x from "md4x/wasm";
import MiniSearch from "minisearch";
import { slugify, textContent } from "./utils";
import { MINISEARCH_OPTIONS, toSearchDocuments } from "./search-options";

import type { AsPlainObject } from "minisearch";
import type { SearchDocument } from "./search-options";
import type { DocPage, MarkNode, SearchSection, TocLink } from "./types";

// --- search sections ---
// One section per page (the h1/title) plus one per h2/h3 heading, each carrying
// the FULL prose under it (full-text search); the payload stays bounded because
// only a short `preview` is stored (see `toSearchDocuments`).
export function buildSearch(pages: DocPage[]): SearchSection[] {
  const sections: SearchSection[] = [];
  for (const p of pages) {
    const { intro, bySlug } = sectionTexts(p.body.value);
    sections.push({
      id: p.path,
      title: p.title,
      titles: [],
      level: 1,
      content: cleanText([p.description, intro].filter(Boolean).join(" ")),
    });
    for (const link of flattenToc(p.body.toc.links)) {
      sections.push({
        id: `${p.path}#${link.id}`,
        title: link.text,
        titles: [p.title],
        level: link.depth,
        content: cleanText(bySlug.get(link.id) || ""),
      });
    }
  }
  return sections;
}

// Build the MiniSearch index from the flat section list and serialize it to a
// plain object (`toJSON`). The client rehydrates it via `MiniSearch.loadJS`
// (`src/app/components/docs/DocsSearch.vue`); shipping the pre-built index means
// the browser never re-indexes, and the query-less `/api/docs/search` route is
// baked to a static file at prerender. Options MUST match `MINISEARCH_OPTIONS`.
export function buildSearchIndex(sections: SearchSection[]): AsPlainObject {
  const ms = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);
  ms.addAll(toSearchDocuments(sections));
  return ms.toJSON();
}

// Render a section's raw body text (markdown + lifted `_html` nodes) to clean
// plain text via md4x and normalize whitespace. Kept in full for indexing;
// only `toSearchDocuments` trims it to a short `preview`. Assumes
// `md4x.init()` already ran (the builder calls it upfront).
function cleanText(s: string): string {
  return md4x.renderToText(s).replace(/\s+/g, " ").trim();
}

function isHeading(node: MarkNode): node is [string, Record<string, any>, ...MarkNode[]] {
  return Array.isArray(node) && typeof node[0] === "string" && /^h[1-6]$/.test(node[0]);
}

// Walk the flat block body and collect the prose under each h2/h3 heading
// (keyed by the same slug the TOC uses), plus any intro text before the first
// heading. Deeper headings (h4+) fold into their enclosing section's text.
function sectionTexts(body: MarkNode[]): { intro: string; bySlug: Map<string, string> } {
  const bySlug = new Map<string, string>();
  const introParts: string[] = [];
  let current: { slug: string; parts: string[] } | null = null;
  for (const node of body) {
    if (isHeading(node)) {
      const depth = Number((node[0] as string).slice(1));
      if (depth === 2 || depth === 3) {
        if (current) bySlug.set(current.slug, current.parts.join(" "));
        current = { slug: slugify(textContent(node)), parts: [] };
        continue;
      }
    }
    const text = textContent(node).replace(/\s+/g, " ").trim();
    if (!text) continue;
    (current ? current.parts : introParts).push(text);
  }
  if (current) bySlug.set(current.slug, current.parts.join(" "));
  return { intro: introParts.join(" "), bySlug };
}

function flattenToc(links: TocLink[]): TocLink[] {
  const out: TocLink[] = [];
  for (const l of links) {
    out.push(l);
    if (l.children) out.push(...flattenToc(l.children));
  }
  return out;
}
