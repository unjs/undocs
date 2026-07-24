import type { AsPlainObject } from "minisearch";

// Comark-style AST node: ["tag", props, ...children] | text string | [null, {}, comment]
export type MarkNode = string | MarkElement;
export type MarkElement = [string | null, Record<string, any>, ...MarkNode[]];

export interface MarkTree {
  nodes: MarkNode[];
  frontmatter?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface TocLink {
  id: string;
  depth: number;
  text: string;
  children?: TocLink[];
}

export interface DocPage {
  /** Source path relative to docs dir (e.g. "1.guide/1.index.md") */
  rel: string;
  /** Route path (e.g. "/guide") */
  path: string;
  /** Content id used for edit links (e.g. "content/1.guide/1.index.md") */
  id: string;
  title: string;
  description: string;
  icon?: string;
  order: string;
  automd?: boolean;
  meta: Record<string, any>;
  body: MarkBody;
  /**
   * `[prev, next]` neighbor cards, from the global content order. Populated by
   * the `/api/docs/page/*` route at request time (not stored in the index), so a
   * page render needs a single request instead of a separate `surround` fetch.
   */
  surround?: [SurroundItem | null, SurroundItem | null];
}

export interface MarkBody {
  type: "mark";
  value: MarkNode[];
  toc: { title?: string; searchDepth?: number; depth?: number; links: TocLink[] };
}

export interface NavItem {
  title: string;
  path: string;
  icon?: string;
  page?: boolean;
  children?: NavItem[];
  [key: string]: any;
}

export interface SearchSection {
  id: string;
  title: string;
  titles: string[];
  level: number;
  content: string;
}

export interface SurroundItem {
  title: string;
  description: string;
  path: string;
}

/** Timing + size stats captured during a single `buildIndex()` run. */
export interface BuildStats {
  /** Wall-clock ms for the whole build (md4x.init → nav/search). */
  totalMs: number;
  /** ms spent in each phase, summed across all files. */
  phases: {
    init: number; // md4x.init() (wasm)
    scan: number; // glob + sort of the docs dir
    read: number; // readFile of every .md/.yml
    automd: number; // automd transform (0 when unused)
    parse: number; // md4x.parseAST + parseMeta
    transform: number; // transformBody (AST rewrites)
    highlight: number; // highlightBody (shiki)
    navigation: number; // buildNavigation
    search: number; // buildSearch
  };
  counts: {
    scanned: number; // .md + .yml files matched
    pages: number;
    navItems: number; // total nodes in the nav tree
    searchSections: number;
    codeBlocks: number; // highlighted code fences
    automdPages: number;
  };
  /** Epoch ms when the build finished (freshness marker). */
  builtAt: number;
}

export interface ContentIndex {
  pages: DocPage[];
  byPath: Map<string, DocPage>;
  navigation: NavItem[];
  search: SearchSection[];
  // Pre-built, serialized MiniSearch index (`MiniSearch.toJSON()`). Built once
  // per content build and shipped verbatim by `/api/docs/search`; the client
  // rehydrates it with `MiniSearch.loadJS`. See `src/app/utils/search.ts`.
  searchIndex: AsPlainObject;
  order: string[]; // ordered list of content page paths (excludes blog) for surround
  stats: BuildStats; // build timing/size info (see /_content route)
}
