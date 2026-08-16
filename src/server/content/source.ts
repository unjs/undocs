// Tests: test/content/source.test.ts
import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { getDocsDir } from "./store.ts";
import { resolveMdHref } from "./transforms.ts";
import type { DocPage } from "./types.ts";

/**
 * A page's markdown SOURCE, as every text-serving route hands it out: `/raw/
 * <path>.md`, `llms-full.txt`, and — through the first — the `read_page` WebMCP
 * tool and the docs page's "copy as markdown". Frontmatter stripped, a title
 * (and description) ensured, and file-relative links resolved to route paths.
 */
export async function pageSource(page: DocPage): Promise<string> {
  const source = await readFile(join(getDocsDir(), page.rel), "utf8");
  return ensureTitle(rewriteSourceLinks(stripFrontmatter(source), posix.dirname(page.rel)), page);
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/**
 * Give the source a leading `# Title` (and a `> description` blockquote) when
 * the file itself has none — those pages carry the title in frontmatter, which
 * we just stripped, so without this the text arrives untitled.
 */
function ensureTitle(source: string, page: DocPage): string {
  if (/^\s*#\s/.test(source)) return source;
  return `# ${page.title}\n\n${page.description ? `> ${page.description}\n\n` : ""}${source}`;
}

/**
 * Rewrite file-relative links to the route paths the site serves.
 *
 * Markdown between pages links at FILES (`./2.getting-started.md`,
 * `../guide/1.index.md#anchor`) — that is what a repository host renders, and
 * what the RENDERED page fixes up in the AST (`transformLinks`). The source
 * text never went through that pass, so those hrefs reached an agent (and
 * anyone reading `/raw`) as repository paths: not routes, not fetchable, and
 * still wearing the `NN.` ordering prefixes. `resolveMdHref` is the AST pass's
 * own resolver, so both views of a page agree about where a link points.
 *
 * The scan is line-wise so it can skip fenced code blocks — a page SHOWING
 * markdown link syntax is quoting it, not linking. An inline code span on a
 * prose line is not skipped: a `[x](./y.md)` inside backticks is rare enough to
 * trade for a scanner that stays readable.
 */
export function rewriteSourceLinks(source: string, baseDir: string): string {
  const lines = source.split("\n");
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = FENCE_LINE.exec(line);
    if (fence !== undefined) {
      // A closing fence is the same character, at least as long as the opening
      // one, and alone on its line (an info string only opens a block).
      const [, ticks, info] = fenceMatch ?? [];
      if (ticks && ticks[0] === fence[0] && ticks.length >= fence.length && !info!.trim()) {
        fence = undefined;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    lines[i] = line
      .replace(
        INLINE_DEST,
        (_, prefix: string, dest: string) => prefix + resolveDest(dest, baseDir),
      )
      .replace(REF_DEF, (_, prefix: string, dest: string) => prefix + resolveDest(dest, baseDir));
  }
  return lines.join("\n");
}

/** ` ```ts `, `~~~`: the opening captures its info string, so a close can be told apart. */
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/;
/** The destination of an inline link/image: `](./foo.md)`, `](<./foo.md> "Title")`. */
const INLINE_DEST = /(\]\(\s*)(<[^>\n]*>|[^\s)]*)/g;
/** A link reference definition: `[label]: ./foo.md "Title"`. */
const REF_DEF = /^( {0,3}\[[^\]\n]+\]:[ \t]+)(<[^>\n]*>|\S+)/;

/** Resolve one destination, preserving the `<…>` wrapper CommonMark allows. */
function resolveDest(dest: string, baseDir: string): string {
  const wrapped = dest.startsWith("<") && dest.endsWith(">");
  const resolved = resolveMdHref(wrapped ? dest.slice(1, -1) : dest, baseDir);
  return wrapped ? `<${resolved}>` : resolved;
}
