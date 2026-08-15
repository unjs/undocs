// Tests: test/content/builder.test.ts
import { readFile, glob } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import * as md4x from "md4x/wasm";
import {
  createSlugger,
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

import type { BuildStats, ContentIndex, DocPage, MarkNode, NavItem, TocLink } from "./types.ts";

// Content files, plus `.navigation.yml` directory-config files. The latter are
// dot-prefixed, so they need their own glob (a `**/*` glob never matches leading
// dots) and an EXCLUDE exemption below.
const INCLUDE = ["**/*.{md,yml}", "**/.navigation.yml"];
// Tested against a LEADING-slash path ("/" + relative). Shared with the dev
// watcher (`dev-watch.ts`), which must not descend into what we never scan —
// `node_modules` alone is ~20x the directory count of real content.
export const EXCLUDE = [/(^|\/)\./, /\/node_modules\//, /\/dist\//, /\/\.docs\//];

export interface BuildOptions {
  dir: string;
  automd?: unknown;
}

const now = () => performance.now();

/**
 * Sort key for the scanned files: an unnumbered index page leads its directory.
 *
 * `orderKey` gives an unnumbered file the key `999999<name>`, which sorts it
 * alphabetically among its unnumbered siblings — and that is wrong for an index
 * page specifically, because an index IS its directory and cannot meaningfully
 * come after the pages inside it. Left alone, `index.md` beside `another.md`
 * lists the docs' front page second, and `guide/README.md` lands after
 * `guide/2.usage.md`.
 *
 * So an index page's own segment drops out of the key, leaving its directory's —
 * which sorts ahead of every numbered and unnumbered sibling. Only when the
 * author did not say otherwise: a numbered `1.index.md` keeps its number, since
 * that is an explicit ordering choice.
 *
 * One key drives the file walk, and with it the nav tree, `index.order` and
 * prev/next — so pinning it here keeps all three agreeing, which a nav-only
 * special case would not.
 */
function scanKey(rel: string): string {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  if (!isIndexFile(rel) || name !== stripPrefix(name)) return orderKey(rel);
  const key = orderKey(rel);
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * Drop a `README.md` that sits beside an `index.md` in the same directory.
 *
 * The two are aliases (`isIndexFile`), so both resolve to the SAME route — a
 * directory holding both would otherwise build two pages onto one path, and
 * which of them won would come down to sort order. The explicit `index.md` is
 * the one that wins; the README is left out of the build entirely (it is
 * usually a repo-facing stub pointing at the real docs).
 *
 * Only a `.md` file can shadow. `isIndexFile` ignores the extension (it also
 * names the route a `.yml` would take, and `toRoutePath` strips both), but no
 * page is ever built from a `.yml` — so a data file that happens to be called
 * `index.yml` is not an index PAGE, and counting it here dropped the sibling
 * README without anything replacing it: the directory's route vanished.
 */
function dropShadowedReadmes(files: string[]): string[] {
  const dirOf = (rel: string) => rel.slice(0, rel.lastIndexOf("/") + 1);
  const canonical = new Set(
    files.filter((rel) => rel.endsWith(".md") && isIndexFile(rel) && !isReadmeFile(rel)).map(dirOf),
  );
  return files.filter((rel) => !(isReadmeFile(rel) && canonical.has(dirOf(rel))));
}

/**
 * Drop files whose route path a previous file already claimed.
 *
 * `dropShadowedReadmes` only settles the README-vs-index pair inside ONE
 * directory; `toRoutePath` collapses far more than that. `guide.md` and
 * `guide/index.md` both resolve to `/guide`, as do `index.md` and `1.index.md`
 * at the root. Left alone, both files build: `byPath` silently keeps whichever
 * came last (the other page is unreachable, with no diagnostic), `index.order`
 * lists the route twice — and since prev/next is `order.indexOf(page.path)`,
 * the page's "Next" card then points at itself.
 *
 * The winner is the file that comes FIRST in the build's own walk order (the
 * caller has already sorted by `scanKey`). That is deterministic across
 * filesystems, and it leaves the surviving page exactly where the route already
 * sat in `index.order` and the nav tree — dropping a LATER file cannot move it.
 * The loser is named in the warning, since a silently missing page is the whole
 * defect. `.yml` files pass through untouched: `.navigation.yml` is keyed by its
 * directory, not by a route of its own.
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
 * A leading node that can hold neither the page title nor its description.
 *
 * The unjs README shape opens with exactly this: automd markers
 * (`<!-- automd:badges -->`, parsed as `[null, {}, …]`), the badge row they wrap
 * (a paragraph of images/links with no prose), and/or a raw
 * `<div align="center">` header. None of it is content, but all of it sits ahead
 * of the `h1` the title/description probes are looking for.
 *
 * Deliberately narrow — anything carrying readable text stops the walk, so a
 * page with a real intro paragraph never has a mid-page `h2`-ish `h1` mistaken
 * for its title. Raw HTML is `html_block` here: these probes run BEFORE
 * `transformBody`, which is what lifts it to `_html` (matched too, so the
 * predicate stays correct on either side of that transform).
 */
function isPreamble(node: MarkNode | undefined): boolean {
  if (typeof node === "string") return node.trim() === "";
  if (!Array.isArray(node)) return false;
  const tag = node[0];
  if (tag === null || tag === "html_block" || tag === "_html") return true;
  return tag === "p" && textContent(node).trim() === "";
}

/** Index of the first node at or after `from` that the probes may inspect. */
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

  const automdTransform = opts.automd ? await createAutomd(dir, opts.automd) : undefined;

  // scan
  mark = now();
  const scanned: string[] = [];
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
    scanned.push(rel);
  }
  const sorted = dropShadowedReadmes(scanned);
  // The `|| a.localeCompare(b)` tiebreak is what makes the walk — and with it
  // the duplicate-route winner below — independent of readdir order in the one
  // case `scanKey` can tie (two index-named files in a directory, e.g.
  // `index.md` beside `Index.md`).
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
    phases.parse += now() - mark;
    const fm = (tree.frontmatter || {}) as Record<string, any>;
    let body = tree.nodes as MarkNode[];
    const path = toRoutePath(rel);

    // title & description (frontmatter, else first h1 / first blockquote)
    let title: string | undefined = fm.title;
    let description: string = fm.description || "";
    // Both probes start at the first node that could BE a title or description,
    // not at `body[0]` — a README-shaped page opens with material that is neither
    // (see `isPreamble`). Looking only at `body[0]` there leaves the h1
    // undetected, so the title falls back to the file name, the description stays
    // empty, and the h1 renders a second time below the page header.
    const h1Index = firstProbeIndex(body);
    const h1 = body[h1Index];
    // Where the description probe starts. Normally the h1's own slot — it is
    // spliced out, so the blockquote slides into it.
    let descFrom = h1Index;
    if (Array.isArray(h1) && h1[0] === "h1") {
      const t = textContent(h1);
      if (!title) title = t;
      // Consumed by the page header — drop it in place (it may sit under
      // preamble, so `shift()` would remove the wrong node).
      if (t === title) {
        body.splice(h1Index, 1);
      } else {
        // Frontmatter named a different title, so the h1 is body content and
        // STAYS (the header shows the frontmatter title, this renders below it).
        // The description blockquote is then the node after it, not at h1Index.
        descFrom = h1Index + 1;
      }
    }
    const bqIndex = firstProbeIndex(body, descFrom);
    const bq = body[bqIndex];
    if (Array.isArray(bq) && bq[0] === "blockquote") {
      const t = textContent(bq).trim();
      // Skip GitHub alert blockquotes (`> [!NOTE]`, `> !...`) — they're callouts,
      // not the page description. This runs before `transformBody` normalizes
      // alerts, so the raw blockquote text is still what we see here.
      if (t && !/^\[?!/.test(t) && !description) {
        description = t;
        body.splice(bqIndex, 1);
      }
    }
    if (!title) title = titleCase(path.split("/").pop() || "Home");

    // transforms + highlight
    mark = now();
    body = transformBody(body, rel);
    phases.transform += now() - mark;
    mark = now();
    codeBlocks += highlightBody(body);
    phases.highlight += now() - mark;

    // toc (nested h2 > h3) — also stamps every heading's `id`, so it must run
    // after the transforms that rewrite heading nodes.
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
  // Prev/next is a LISTING, so it obeys the same hiding the nav tree does — a
  // page the author kept out of the sidebar must not resurface as its neighbour's
  // "Next" card. A hidden page is still routable and searchable; it simply has no
  // place in the chain, so `order.indexOf` misses it and it renders no surround.
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

// Total number of nodes in the navigation tree (for build stats).
function countNav(items: NavItem[]): number {
  let n = 0;
  for (const item of items) {
    n += 1 + (item.children ? countNav(item.children) : 0);
  }
  return n;
}

// --- toc + heading ids ---
/**
 * Give every heading in the body its `id` and collect the h2/h3 ones into the
 * page's TOC — ONE walk, one derivation.
 *
 * The TOC is built here, on the server, while the ids are emitted by the CLIENT
 * renderer during SSR and hydration. Deriving the id twice (this used to slug
 * `md4x.parseMeta().headings` while `MarkdownRenderer` slugged the AST node) is
 * a desync waiting to happen, and once ids need de-duplicating it is a certainty:
 * the two sides see different heading LISTS (the page's h1 is spliced out of the
 * body, raw-HTML headings never reach the renderer), so any counter they each
 * keep drifts apart and the TOC links point at nothing. Instead the id is
 * allocated once, written onto the node, and shipped in the body payload —
 * `MarkdownRenderer` finds `props.id` already set and only falls back to
 * `slugify` for bodies that never came through here.
 *
 * The walk recurses, because `parseMeta` counted headings inside containers
 * (`::tabs`) too and the renderer anchors them all the same.
 */
function buildToc(body: MarkNode[]): TocLink[] {
  const slug = createSlugger();
  const links: TocLink[] = [];
  const visit = (nodes: MarkNode[]): void => {
    for (const node of nodes) {
      if (!Array.isArray(node)) continue;
      const tag = node[0];
      if (typeof tag !== "string") continue;
      const level = /^h([1-6])$/.exec(tag);
      if (level) {
        // md4x emits no heading ids of its own (`## H {#anchor}` parses as
        // literal text), so this is always the allocator's to assign.
        const props = (node[1] ||= {});
        const text = textContent(node);
        const id = slug(text);
        props.id = id;
        const depth = Number(level[1]);
        if (depth === 2 || depth === 3) {
          const link: TocLink = { id, depth, text };
          const parent = depth === 3 ? links[links.length - 1] : undefined;
          if (parent) (parent.children ||= []).push(link);
          else links.push(link);
        }
      }
      visit(node.slice(2) as MarkNode[]);
    }
  };
  visit(body);
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

/**
 * Overlay a directory's `.navigation.yml` onto its node, recording whether it
 * NAMED the section.
 *
 * Every other title in the tree is derived — from the directory segment, or from
 * the index page — and `mobileNavLinks` re-derives one of them from the other to
 * keep a drawer group's header from repeating its own index child. By the time
 * the client sees the tree those two cases are indistinguishable from an
 * author's explicit `title:`, so the fact is recorded here, at the only place
 * that still knows it. The flag tracks the last assignment, since a config
 * without a `title:` leaves the derived one in place.
 */
function applyConfigFields(node: Record<string, any>, cfg: Record<string, unknown>): void {
  const fields = configFields(cfg);
  Object.assign(node, fields);
  node.titleFromConfig = typeof fields.title === "string";
}

/**
 * Every page the author hid from the navigation, by path.
 *
 * Two ways to say it: `navigation: false` in a page's own frontmatter, or a
 * directory `.navigation.yml` carrying `navigation: false`, which hides its whole
 * subtree. Hidden means "routable but not listed" — the page still builds, still
 * answers on its route and still lands in the search index.
 *
 * The docs ROOT is the one directory that does NOT hide its subtree, and that is
 * deliberate. Its subtree is the whole docs set, so reading it the way every
 * other directory reads it would empty the sidebar outright — and empty the
 * prev/next chain with it, since `index.order` consumes this same set. A docs
 * site with no navigation at all is not something anyone configures on purpose,
 * whereas the narrow reading is useful and is what an author who wrote it was
 * almost certainly after: drop the "Home" entry from the sidebar, keep the rest.
 * So a root `navigation: false` hides exactly `/`. The rest of that file is
 * untouched by this: the root `.navigation.yml` is also where a docs set names
 * itself, and `buildNavigation` still applies its title/icon/… to the root nav
 * item — the item `navigation: false` is the one key that removes.
 * That narrow behaviour is what shipped, but only by accident: the subtree test
 * used to be `path.startsWith(d + "/")`, which for the root key is `"//"` and
 * matches nothing. Splitting exact matches from prefixes states the intent and
 * removes the string-concatenation coincidence holding it up. Since the same
 * spelling means something wider in every other directory, say so once per build.
 *
 * The set is computed ONCE, here, because two listings consume it: the nav tree
 * below and `index.order` (prev/next). Deriving it twice is how the surround
 * cards came to link at pages the sidebar had dropped.
 */
function hiddenPaths(
  pages: DocPage[],
  navYml: Record<string, Record<string, unknown>>,
): Set<string> {
  // Directories explicitly hidden via `.navigation.yml` → `navigation: false`.
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
    // A page can opt out of the nav tree with `navigation: false` — its own, or
    // its directory's — while staying routable and searchable (`hiddenPaths`).
    if (hidden.has(p.path)) continue;

    // The docs-root `index.md`. It has no path segment, so the walk below never
    // sees it — add it directly as the tree's first item (content is sorted by
    // `orderKey`, and a root index sorts ahead of every sibling). Flagged `root`
    // so a landing-page site can strip it back out: with a landing owning `/`,
    // a "Home" entry in the sidebar would just point at the landing (see
    // `app.vue` → `resolveLanding`).
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
        // A directory index page (`index.md` / `README.md`) is exposed as its own
        // first child in the nav tree — so a section with an index keeps its own
        // identity instead of collapsing into a lone subchild.
        node._index = isIndexFile(p.rel);
        // The page's own `navigation:` frontmatter overrides derived fields...
        Object.assign(node, navOverride(p.meta));
        // ...but the directory's `.navigation.yml` still wins over the index page.
        if (navYml[curPath]) applyConfigFields(node, navYml[curPath]);
      }
      level = node._children;
    }
  }

  const clean = (nodes: RawNode[]): NavItem[] =>
    nodes.map((n) => {
      // Carry every non-internal field through (title/path/icon/description plus
      // custom nav flags like badge/section), stripping only the build-time
      // bookkeeping keys.
      // `titleFromConfig` comes out with the bookkeeping keys rather than with
      // `fields`: the self-index child below spreads `fields` and then overwrites
      // the title with the PAGE's, so carrying the flag through would claim the
      // author named a title they did not.
      const { _seg, _children, _page, _index, page, titleFromConfig, ...fields } = n;
      void _seg;
      const out: NavItem = { ...fields, page: !!page };
      if (titleFromConfig) out.titleFromConfig = true;
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
