import { readFile, glob } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import * as md4x from "md4x/wasm";
import {
  isIndexFile,
  isReadmeFile,
  orderKey,
  stripPrefix,
  textContent,
  titleCase,
  toRoutePath,
} from "./utils.ts";
import { transformBody } from "./transforms.ts";
import { highlightBody } from "./highlight.ts";
import { resolveIcon } from "./icons.ts";
import { buildSearch, buildSearchIndex } from "./search.ts";
import { pmInstallLatest } from "./automd-generators.ts";

import type {
  BuildStats,
  ContentIndex,
  DocPage,
  MarkElement,
  MarkNode,
  NavItem,
  TocLink,
} from "./types.ts";

// Dot-prefixed `.navigation.yml` needs its own glob and bypasses the dotfile exclusion below.
const INCLUDE = ["**/*.{md,yml}", "**/.navigation.yml"];
// These match leading-slash paths and are shared with the dev watcher.
export const EXCLUDE = [/(^|\/)\./, /\/node_modules\//, /\/dist\//, /\/\.docs\//];

export interface BuildOptions {
  dir: string;
  automd?: unknown;
  /** Canonical site URL, for automd generators that must emit absolute links. */
  url?: string;
}

const now = () => performance.now();

/**
 * Make an unnumbered index lead its directory; numbered indexes preserve the
 * author's explicit order. This key also drives navigation and prev/next.
 */
function scanKey(rel: string): string {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  if (!isIndexFile(rel) || name !== stripPrefix(name)) return orderKey(rel);
  const key = orderKey(rel);
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * Prefer `index.md` over its same-directory `README.md` route alias. Only
 * Markdown can shadow: an `index.yml` never builds a replacement page.
 */
function dropShadowedReadmes(files: string[]): string[] {
  const dirOf = (rel: string) => rel.slice(0, rel.lastIndexOf("/") + 1);
  const canonical = new Set(
    files.filter((rel) => rel.endsWith(".md") && isIndexFile(rel) && !isReadmeFile(rel)).map(dirOf),
  );
  return files.filter((rel) => !(isReadmeFile(rel) && canonical.has(dirOf(rel))));
}

/**
 * Keep the first sorted file for each route and warn about later collisions.
 * This prevents duplicate order entries from making a page its own neighbor.
 * YAML passes through because its config is directory-keyed, not a page route.
 */
function dropDuplicateRoutes(files: string[]): string[] {
  const winners = new Map<string, string>();
  return files.filter((rel) => {
    if (rel.endsWith(".yml")) return true;
    const path = toRoutePath(rel);
    const winner = winners.get(path);
    if (winner !== undefined) {
      console.warn(`[undocs] duplicate route ${path}: keeping "${winner}", ignoring "${rel}".`);
      return false;
    }
    winners.set(path, rel);
    return true;
  });
}

/**
 * Skip only non-prose README preamble (automd comments, badge-only paragraphs,
 * and block HTML) before probing for title/description. Real text stops the scan.
 */
function isPreamble(node: MarkNode | undefined): boolean {
  if (typeof node === "string") return node.trim() === "";
  if (!Array.isArray(node)) return false;
  const tag = node[0];
  if (tag === null || tag === "_html") return true;
  if (tag === "html") return node[1]?.block === true;
  return tag === "p" && textContent(node).trim() === "";
}

function firstProbeIndex(body: MarkNode[], from = 0): number {
  let i = from;
  while (i < body.length && isPreamble(body[i])) i++;
  return i;
}

export async function buildIndex(opts: BuildOptions): Promise<ContentIndex> {
  const t0 = now();
  const phases: BuildStats["phases"] = {
    init: 0,
    scan: 0,
    read: 0,
    automd: 0,
    parse: 0,
    transform: 0,
    highlight: 0,
    navigation: 0,
    search: 0,
  };
  let codeBlocks = 0;
  let automdPages = 0;

  let mark = now();
  await md4x.init();
  phases.init = now() - mark;

  const dir = opts.dir;

  const automdTransform = opts.automd ? await createAutomd(dir, opts.automd, opts.url) : undefined;

  mark = now();
  const scanned: string[] = [];
  const seen = new Set<string>();
  for await (const f of glob(INCLUDE, { cwd: dir })) {
    const rel = f.split("\\").join("/");
    // Let `.navigation.yml` bypass only the dotfile exclusion.
    const isNavConfig = basename(rel) === ".navigation.yml";
    const rules = isNavConfig ? EXCLUDE.slice(1) : EXCLUDE;
    if (rules.some((re) => re.test("/" + rel))) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);
    scanned.push(rel);
  }
  const sorted = dropShadowedReadmes(scanned);
  // Stabilize duplicate-route winners when two index names share a scan key.
  sorted.sort((a, b) => scanKey(a).localeCompare(scanKey(b)) || a.localeCompare(b));
  const files = dropDuplicateRoutes(sorted);
  phases.scan = now() - mark;

  const navYml: Record<string, Record<string, unknown>> = {};
  const pages: DocPage[] = [];

  for (const rel of files) {
    if (rel.endsWith(".yml")) {
      if (basename(rel) === ".navigation.yml") {
        mark = now();
        const ymlRaw = await readFile(join(dir, rel), "utf8");
        phases.read += now() - mark;
        // Avoid deriving the docs-root key as `/.`.
        const relDir = dirname(rel);
        const dirPath = relDir === "." ? "/" : toRoutePath(relDir + "/index.md");
        navYml[dirPath] = parseNavYml(ymlRaw);
      }
      continue;
    }

    const filePath = join(dir, rel);
    mark = now();
    let raw = await readFile(filePath, "utf8");
    phases.read += now() - mark;
    let automd = false;
    if (automdTransform && raw.includes("<!-- automd:")) {
      mark = now();
      raw = await automdTransform(raw, filePath, rel);
      phases.automd += now() - mark;
      automd = true;
      automdPages++;
    }

    mark = now();
    const tree = md4x.parseAST(raw);
    phases.parse += now() - mark;
    const fm = (tree.frontmatter || {}) as Record<string, any>;
    let body = tree.nodes as MarkNode[];
    const path = toRoutePath(rel);

    let title: string | undefined = fm.title;
    let description: string = fm.description || "";
    // README preamble may precede the title and description.
    const h1Index = firstProbeIndex(body);
    const h1 = body[h1Index];
    let descFrom = h1Index;
    if (Array.isArray(h1) && h1[0] === "h1") {
      // md4x-resolved text must compare to the likewise resolved frontmatter title.
      const t = textContent(h1);
      if (!title) title = t;
      // Remove in place because preamble may precede it.
      if (t === title) {
        body.splice(h1Index, 1);
      } else {
        // A distinct frontmatter title leaves this heading as body content.
        descFrom = h1Index + 1;
      }
    }
    const bqIndex = firstProbeIndex(body, descFrom);
    const bq = body[bqIndex];
    if (Array.isArray(bq) && bq[0] === "blockquote") {
      const t = textContent(bq).trim();
      // Raw GitHub alert blockquotes are callouts, not page descriptions.
      if (t && !/^\[?!/.test(t) && !description) {
        description = t;
        body.splice(bqIndex, 1);
      }
    }
    if (!title) title = titleCase(path.split("/").pop() || "Home");

    mark = now();
    body = transformBody(body, rel);
    phases.transform += now() - mark;
    mark = now();
    codeBlocks += highlightBody(body);
    phases.highlight += now() - mark;

    // Heading IDs must follow transforms that rewrite heading nodes.
    const toc = buildToc(body);
    const icon = fm.icon || fm.navigation?.icon || resolveIcon(path) || undefined;

    pages.push({
      rel,
      path,
      id: "content/" + rel,
      title,
      description,
      icon,
      order: orderKey(rel),
      automd,
      meta: fm,
      body: { type: "mark", value: body, toc: { title: "On this page", links: toc } },
    });
  }

  const byPath = new Map(pages.map((p) => [p.path, p]));
  mark = now();
  const hidden = hiddenPaths(pages, navYml);
  const navigation = buildNavigation(pages, navYml, hidden);
  phases.navigation = now() - mark;
  mark = now();
  const search = buildSearch(pages);
  const searchIndex = buildSearchIndex(search);
  phases.search = now() - mark;
  // Prev/next follows navigation visibility; hidden pages remain routable/searchable.
  const order = pages
    .filter((p) => !hidden.has(p.path) && p.path !== "/blog" && !p.path.startsWith("/blog/"))
    .map((p) => p.path);

  const stats: BuildStats = {
    totalMs: now() - t0,
    phases,
    counts: {
      scanned: files.length,
      pages: pages.length,
      navItems: countNav(navigation),
      searchSections: search.length,
      codeBlocks,
      automdPages,
    },
    builtAt: Date.now(),
  };

  return { pages, byPath, navigation, search, searchIndex, order, stats };
}

function countNav(items: NavItem[]): number {
  let n = 0;
  for (const item of items) {
    n += 1 + (item.children ? countNav(item.children) : 0);
  }
  return n;
}

/**
 * Read parser-assigned heading IDs; re-slugging after transforms would drift
 * de-duplication suffixes. Allocate collision-free fallbacks only for empty IDs,
 * and recurse for headings inside containers.
 */
const FALLBACK_HEADING_ID = "section";

function buildToc(body: MarkNode[]): TocLink[] {
  const headings: MarkElement[] = [];
  const visit = (nodes: MarkNode[]): void => {
    for (const node of nodes) {
      if (!Array.isArray(node)) continue;
      if (typeof node[0] === "string" && /^h[1-6]$/.test(node[0])) headings.push(node);
      visit(node.slice(2) as MarkNode[]);
    }
  };
  visit(body);

  // Include later IDs before allocating fallbacks.
  const used = new Set<string>();
  for (const node of headings) {
    const id = node[1]?.id;
    if (typeof id === "string" && id) used.add(id);
  }

  const links: TocLink[] = [];
  for (const node of headings) {
    const props = (node[1] ||= {});
    let id: string = typeof props.id === "string" ? props.id : "";
    if (!id) {
      id = FALLBACK_HEADING_ID;
      for (let n = 2; used.has(id); n++) id = `${FALLBACK_HEADING_ID}-${n}`;
      used.add(id);
      props.id = id;
    }
    const depth = Number((node[0] as string).slice(1));
    if (depth === 2 || depth === 3) {
      const link: TocLink = { id, depth, text: textContent(node) };
      const parent = depth === 3 ? links[links.length - 1] : undefined;
      if (parent) (parent.children ||= []).push(link);
      else links.push(link);
    }
  }
  return links;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// User config may set display/custom fields, but never structural bookkeeping.
const RESERVED_NAV_KEYS = new Set([
  "_seg",
  "_children",
  "_page",
  "_index",
  "children",
  "page",
  "root",
  "synthetic",
  "titleFromConfig",
]);

function stripReserved(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in fields) {
    if (!RESERVED_NAV_KEYS.has(k)) out[k] = fields[k];
  }
  return out;
}

function navOverride(source: Record<string, any> | undefined): Record<string, any> {
  const nav = source?.navigation;
  return isPlainObject(nav) ? stripReserved(nav) : {};
}

// Nested `navigation` overrides legacy flat config fields.
function configFields(cfg: Record<string, any>): Record<string, any> {
  const { navigation, ...flat } = cfg;
  return stripReserved({ ...flat, ...(isPlainObject(navigation) ? navigation : {}) });
}

/** Preserve whether a section title was explicitly configured for client nav shaping. */
function applyConfigFields(node: Record<string, any>, cfg: Record<string, unknown>): void {
  const fields = configFields(cfg);
  Object.assign(node, fields);
  node.titleFromConfig = typeof fields.title === "string";
}

/**
 * Resolve page and directory `navigation: false` once for both nav and prev/next.
 * Hidden pages remain routable/searchable. Root config hides only `/`; treating
 * it as a subtree would erase the entire site navigation.
 */
function hiddenPaths(
  pages: DocPage[],
  navYml: Record<string, Record<string, unknown>>,
): Set<string> {
  const hiddenSelf = new Set<string>();
  const hiddenSubtrees: string[] = [];
  for (const [dirPath, cfg] of Object.entries(navYml)) {
    if ((cfg as any)?.navigation !== false) continue;
    hiddenSelf.add(dirPath);
    if (dirPath === "/") {
      console.warn(
        `[undocs] root .navigation.yml: \`navigation: false\` hides only the docs-root index page ("/"), not the whole site. Hide other pages with \`navigation: false\` in their own frontmatter or in a subdirectory's .navigation.yml.`,
      );
      continue;
    }
    hiddenSubtrees.push(dirPath + "/");
  }
  const hidden = new Set<string>();
  for (const p of pages) {
    if (
      (p.meta as any)?.navigation === false ||
      hiddenSelf.has(p.path) ||
      hiddenSubtrees.some((d) => p.path.startsWith(d))
    ) {
      hidden.add(p.path);
    }
  }
  return hidden;
}

function buildNavigation(
  pages: DocPage[],
  navYml: Record<string, Record<string, unknown>>,
  hidden: Set<string>,
): NavItem[] {
  interface RawNode extends NavItem {
    _seg?: string;
    _children: RawNode[];
    _page?: DocPage;
    _index?: boolean;
  }
  const root: RawNode[] = [];

  for (const p of pages) {
    // Hidden pages remain in the content and search indexes.
    if (hidden.has(p.path)) continue;

    // Root has no path segment; mark it so landing sites can remove the duplicate `/` link.
    if (p.path === "/") {
      const node: RawNode = {
        _seg: "",
        title: p.title,
        path: "/",
        icon: p.icon,
        description: p.description,
        page: true,
        root: true,
        _page: p,
        _children: [],
        ...navOverride(p.meta),
      };
      if (navYml["/"]) applyConfigFields(node, navYml["/"]);
      root.push(node);
      continue;
    }

    const segs = p.path.slice(1).split("/");
    let level = root;
    let curPath = "";
    for (let i = 0; i < segs.length; i++) {
      curPath += "/" + segs[i];
      let node = level.find((n) => n._seg === segs[i]);
      if (!node) {
        node = {
          _seg: segs[i],
          title: titleCase(segs[i]),
          path: curPath,
          _children: [],
        };
        if (navYml[curPath]) applyConfigFields(node, navYml[curPath]);
        level.push(node);
      }
      if (i === segs.length - 1) {
        node.title = p.title;
        node.path = p.path;
        node.icon = p.icon || node.icon;
        node.page = true;
        node._page = p;
        node.description = p.description;
        // Preserve a directory index as the section's first child.
        node._index = isIndexFile(p.rel);
        Object.assign(node, navOverride(p.meta));
        // Directory config wins over page frontmatter.
        if (navYml[curPath]) applyConfigFields(node, navYml[curPath]);
      }
      level = node._children;
    }
  }

  const clean = (nodes: RawNode[]): NavItem[] =>
    nodes.map((n) => {
      // Strip bookkeeping while preserving custom fields. Do not leak the section's
      // `titleFromConfig` onto its page child below.
      const { _seg, _children, _page, _index, page, titleFromConfig, ...fields } = n;
      void _seg;
      const out: NavItem = { ...fields, page: !!page };
      if (titleFromConfig) out.titleFromConfig = true;
      const kids = _children.length ? clean(_children) : [];
      if (_index) {
        // The child represents the page, not the directory-configured section label.
        const idx = _page!;
        out.children = [
          {
            ...fields,
            title: idx.title,
            icon: idx.icon ?? fields.icon,
            description: idx.description,
            ...navOverride(idx.meta),
            page: true,
          },
          ...kids,
        ];
      } else if (kids.length) {
        out.children = kids;
        if (!page) out.path = kids[0].path;
      }
      return out;
    });

  return clean(root);
}

function parseNavYml(raw: string): Record<string, unknown> {
  return md4x.parseMeta(`---\n${raw}\n---\n`).frontmatter ?? {};
}

/**
 * Automd failures are recoverable but warned: retain the entire original source
 * rather than publishing partial output or generated issue comments.
 */
async function createAutomd(dir: string, automdConfig: unknown, url?: string) {
  try {
    const automd = await import("automd");
    const config = await automd.loadConfig(dir, automdConfig as any);
    // Registered UNDER the docs project's own generators: a project that defines
    // `pm-i` itself keeps it, and undocs only fills the name in when it is free.
    const pmInstall = pmInstallLatest(url);
    config.generators = { "pm-i": pmInstall, "pm-install": pmInstall, ...config.generators };
    return async (content: string, path: string, rel: string): Promise<string> => {
      try {
        const res = await automd.transform(content, config, pathToFileURL(path).href);
        if (!res.hasIssues) {
          return res.contents;
        }
        const issues = res.updates.flatMap((u) =>
          (u.result.issues || [])
            .filter(Boolean)
            .map((issue) => `  - ${u.block.generator}: ${issue}`),
        );
        console.warn(
          `[undocs] automd issues in "${rel}" (keeping the source, generated blocks are not filled in):\n${issues.join("\n")}`,
        );
      } catch (error) {
        console.warn(
          `[undocs] automd failed for "${rel}" (keeping the source, generated blocks are not filled in): ${error}`,
        );
      }
      return content;
    };
  } catch (error) {
    console.warn(`[undocs] automd is configured but could not be loaded: ${error}`);
    return undefined;
  }
}
