import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { getDocsDir } from "./store.ts";
import { resolveMdHref } from "./transforms.ts";
import type { DocPage } from "./types.ts";

// Canonical frontmatter-free source for raw, llms-full, WebMCP, and copy-as-Markdown.

export async function pageSource(page: DocPage): Promise<string> {
  const source = await readFile(join(getDocsDir(), page.rel), "utf8");
  return ensureTitle(rewriteSourceLinks(stripFrontmatter(source), posix.dirname(page.rel)), page);
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "");
}

// Restore titles/descriptions that existed only in stripped frontmatter.

function ensureTitle(source: string, page: DocPage): string {
  if (/^\s*#\s/.test(source)) return source;
  return `# ${page.title}\n\n${page.description ? `> ${page.description}\n\n` : ""}${source}`;
}

// Reuse AST link resolution so raw and rendered pages agree. Scan line-wise to
// skip fenced examples; inline-code links are an accepted readability tradeoff.

export function rewriteSourceLinks(source: string, baseDir: string): string {
  const lines = source.split("\n");
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = FENCE_LINE.exec(line);
    if (fence !== undefined) {
      // A close uses the same character, at least the opening length, without info text.
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

const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/;
const INLINE_DEST = /(\]\(\s*)(<[^>\n]*>|[^\s)]*)/g;
const REF_DEF = /^( {0,3}\[[^\]\n]+\]:[ \t]+)(<[^>\n]*>|\S+)/;

// Preserve CommonMark's optional `<…>` destination wrapper.
function resolveDest(dest: string, baseDir: string): string {
  const wrapped = dest.startsWith("<") && dest.endsWith(">");
  const resolved = resolveMdHref(wrapped ? dest.slice(1, -1) : dest, baseDir);
  return wrapped ? `<${resolved}>` : resolved;
}
