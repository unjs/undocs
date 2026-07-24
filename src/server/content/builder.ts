// Tests: test/content/builder.test.ts
import { readFile, glob } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import * as md4x from "md4x/wasm";
import { orderKey, slugify, stripPrefix, textContent, titleCase, toRoutePath } from "./utils";
import { transformBody } from "./transforms";
import { highlightBody } from "./highlight";
import { resolveIcon } from "./icons";
import { buildSearch, buildSearchIndex } from "./search";

import type { BuildStats, ContentIndex, DocPage, MarkNode, NavItem, TocLink } from "./types";

// Content files, plus `.navigation.yml` directory-config files. The latter are
// dot-prefixed, so they need their own glob (a `**/*` glob never matches leading
// dots) and an EXCLUDE exemption below.
const INCLUDE = ["**/*.{md,yml}", "**/.navigation.yml"];
const EXCLUDE = [/(^|\/)\./, /\/node_modules\//, /\/dist\//, /\/\.docs\//];

export interface BuildOptions {
  dir: string;
  automd?: unknown;
}

const now = () => performance.now();

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

  const automdTransform = opts.automd ? await createAutomd(dir, opts.automd) : undefined;

  // scan
  mark = now();
  const files: string[] = [];
  const seen = new Set<string>();
  for await (const f of glob(INCLUDE, { cwd: dir })) {
    const rel = f.split("\\").join("/");
    // `.navigation.yml` is deliberately dot-prefixed; let it past the dotfile
    // rule (the other EXCLUDE rules — node_modules/dist/.docs — still apply).
    const isNavConfig = basename(rel) === ".navigation.yml";
    const rules = isNavConfig ? EXCLUDE.slice(1) : EXCLUDE;
    if (rules.some((re) => re.test("/" + rel))) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);
    files.push(rel);
  }
  files.sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
  phases.scan = now() - mark;

  const navYml: Record<string, Record<string, unknown>> = {};
  const pages: DocPage[] = [];

  for (const rel of files) {
    if (rel.endsWith(".yml")) {
      if (basename(rel) === ".navigation.yml") {
        mark = now();
        const ymlRaw = await readFile(join(dir, rel), "utf8");
        phases.read += now() - mark;
        // Key by the directory's route path. `dirname` is "." at the docs root,
        // which would derive the bogus key "/." — normalize it to "/".
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
      raw = await automdTransform(raw, filePath);
      phases.automd += now() - mark;
      automd = true;
      automdPages++;
    }

    mark = now();
    const tree = md4x.parseAST(raw);
    const meta = md4x.parseMeta(raw);
    phases.parse += now() - mark;
    const fm = (tree.frontmatter || {}) as Record<string, any>;
    let body = tree.nodes as MarkNode[];
    const path = toRoutePath(rel);

    // title & description (frontmatter, else first h1 / first blockquote)
    let title: string | undefined = fm.title;
    let description: string = fm.description || "";
    if (Array.isArray(body[0]) && body[0][0] === "h1") {
      const t = textContent(body[0]);
      if (!title) title = t;
      if (t === title) body.shift();
    }
    if (Array.isArray(body[0]) && body[0][0] === "blockquote") {
      const t = textContent(body[0]).trim();
      // Skip GitHub alert blockquotes (`> [!NOTE]`, `> !...`) — they're callouts,
      // not the page description. This runs before `transformBody` normalizes
      // alerts, so the raw blockquote text is still what we see here.
      if (t && !/^\[?!/.test(t) && !description) {
        description = t;
        body.shift();
      }
    }
    if (!title) title = titleCase(path.split("/").pop() || "Home");

    // transforms + highlight
    mark = now();
    body = transformBody(body, rel);
    phases.transform += now() - mark;
    mark = now();
    codeBlocks += await highlightBody(body);
    phases.highlight += now() - mark;

    // toc (nested h2 > h3)
    const toc = buildToc(meta.headings || []);
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
  const navigation = buildNavigation(pages, navYml);
  phases.navigation = now() - mark;
  mark = now();
  const search = buildSearch(pages);
  const searchIndex = buildSearchIndex(search);
  phases.search = now() - mark;
  const order = pages
    .filter((p) => p.path !== "/blog" && !p.path.startsWith("/blog/"))
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

// Total number of nodes in the navigation tree (for build stats).
function countNav(items: NavItem[]): number {
  let n = 0;
  for (const item of items) {
    n += 1 + (item.children ? countNav(item.children) : 0);
  }
  return n;
}

// --- toc ---
function buildToc(headings: { level: number; text: string }[]): TocLink[] {
  const links: TocLink[] = [];
  for (const h of headings) {
    if (h.level < 2 || h.level > 3) continue;
    const link: TocLink = { id: slugify(h.text), depth: h.level, text: h.text };
    if (h.level === 3 && links.length) {
      const parent = links[links.length - 1];
      (parent.children ||= []).push(link);
    } else {
      links.push(link);
    }
  }
  return links;
}

// --- navigation tree ---
function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Structural keys user-supplied YAML/frontmatter must never override — doing so
// would corrupt the tree (e.g. a `.navigation.yml` with a `children:` key would
// be emitted verbatim as a node's children). Display fields like title/icon/
// path/description and arbitrary custom flags are still allowed through.
const RESERVED_NAV_KEYS = new Set(["_seg", "_children", "_page", "_index", "children", "page"]);

function stripReserved(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in fields) {
    if (!RESERVED_NAV_KEYS.has(k)) out[k] = fields[k];
  }
  return out;
}

// Fields a page's own `navigation:` frontmatter contributes to its nav item.
// Everything under an object-valued `navigation` key (title, icon, badge, arbitrary flags) is spread over the item, so `navigation: { title, icon, ... }` overrides the derived values.
function navOverride(source: Record<string, any> | undefined): Record<string, any> {
  const nav = source?.navigation;
  return isPlainObject(nav) ? stripReserved(nav) : {};
}

// Fields a directory's `.navigation.yml` contributes to its section node.
// We support flat top-level keys too (back-compat) and overlay
// the nested `navigation` object on top so it wins.
function configFields(cfg: Record<string, any>): Record<string, any> {
  const { navigation, ...flat } = cfg;
  return stripReserved({ ...flat, ...(isPlainObject(navigation) ? navigation : {}) });
}

function buildNavigation(
  pages: DocPage[],
  navYml: Record<string, Record<string, unknown>>,
): NavItem[] {
  interface RawNode extends NavItem {
    _seg?: string;
    _children: RawNode[];
    _page?: DocPage;
    _index?: boolean;
  }
  const root: RawNode[] = [];

  // Directories explicitly hidden via `.navigation.yml` → `navigation: false`.
  // The whole subtree is dropped from the tree (pages stay routable).
  const hiddenDirs = Object.entries(navYml)
    .filter(([, cfg]) => (cfg as any)?.navigation === false)
    .map(([dirPath]) => dirPath);

  for (const p of pages) {
    // A page can opt out of the nav tree with `navigation: false` while staying
    // routable and searchable.
    if ((p.meta as any)?.navigation === false) continue;
    // Skip pages living under a directory hidden by its `.navigation.yml`.
    if (hiddenDirs.some((d) => p.path === d || p.path.startsWith(d + "/"))) continue;

    const segs = p.path === "/" ? [] : p.path.slice(1).split("/");
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
        if (navYml[curPath]) Object.assign(node, configFields(navYml[curPath]));
        level.push(node);
      }
      if (i === segs.length - 1) {
        node.title = p.title;
        node.path = p.path;
        node.icon = p.icon || node.icon;
        node.page = true;
        node._page = p;
        node.description = p.description;
        // A directory index page (`index.md`) is exposed as its own first child
        // in the nav tree — so a section with an index keeps its own identity
        // instead of collapsing into a lone subchild.
        node._index = stripPrefix(basename(p.rel)) === "index.md";
        // The page's own `navigation:` frontmatter overrides derived fields...
        Object.assign(node, navOverride(p.meta));
        // ...but the directory's `.navigation.yml` still wins over the index page.
        if (navYml[curPath]) Object.assign(node, configFields(navYml[curPath]));
      }
      level = node._children;
    }
  }

  const clean = (nodes: RawNode[]): NavItem[] =>
    nodes.map((n) => {
      // Carry every non-internal field through (title/path/icon/description plus
      // custom nav flags like badge/section), stripping only the build-time
      // bookkeeping keys.
      const { _seg, _children, _page, _index, page, ...fields } = n;
      void _seg;
      const out: NavItem = { ...fields, page: !!page };
      const kids = _children.length ? clean(_children) : [];
      if (_index) {
        // Re-add the index page itself as the section's first child. The section
        // header (`out`) keeps the directory `.navigation.yml` title/icon, but the
        // child link represents the PAGE — so it carries the page's own
        // title/icon/description (plus any page `navigation:` override), NOT the
        // directory override. Otherwise the index link just duplicates the
        // section label (e.g. a "Guide" link under the "Guide" section instead of
        // "Getting Started").
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

// --- .navigation.yml parser ---
// The file is a YAML block; parse it as frontmatter via md4x. `md4x.init()`
// has already run by the time this is called.
function parseNavYml(raw: string): Record<string, unknown> {
  const { headings: _headings, ...fm } = md4x.parseMeta(`---\n${raw}\n---\n`);
  return fm;
}

// --- automd ---
async function createAutomd(dir: string, automdConfig: unknown) {
  try {
    const automd = await import("automd");
    const config = await automd.loadConfig(dir, automdConfig as any);
    return async (content: string, path: string): Promise<string> => {
      try {
        const res = await automd.transform(content, config, pathToFileURL(path).href);
        if (!res.hasIssues) {
          if (res.hasChanged) {
            await writeFile(path, res.contents, "utf-8");
          }
          return res.contents;
        }
      } catch {
        // ignore automd failures in MVP
      }
      return content;
    };
  } catch {
    return undefined;
  }
}
