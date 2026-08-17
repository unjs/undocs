import type { AsPlainObject } from "minisearch";

// Comark AST comments use `[null, {}, source]`.
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
  rel: string;
  path: string;
  id: string;
  title: string;
  description: string;
  icon?: string;
  order: string;
  automd?: boolean;
  meta: Record<string, any>;
  body: MarkBody;
  /** Injected by the page route, not stored in the shared index. */
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
  /** Top-level docs-root item, removable when a landing page owns `/`. */
  root?: boolean;
  /** Client-invented section; never emitted by the server builder. */
  synthetic?: boolean;
  /** Prevents client nav shaping from replacing an explicitly configured title. */
  titleFromConfig?: boolean;
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

export interface BuildStats {
  totalMs: number;
  phases: {
    init: number;
    scan: number;
    read: number;
    automd: number;
    parse: number;
    transform: number;
    highlight: number;
    navigation: number;
    search: number;
  };
  counts: {
    scanned: number;
    pages: number;
    navItems: number;
    searchSections: number;
    codeBlocks: number;
    automdPages: number;
  };
  builtAt: number;
}

export interface ContentIndex {
  pages: DocPage[];
  byPath: Map<string, DocPage>;
  navigation: NavItem[];
  search: SearchSection[];
  // Serialized once server-side; client rehydrates without re-indexing.
  searchIndex: AsPlainObject;
  // Prev/next order excludes blog and navigation-hidden pages.
  order: string[];
  stats: BuildStats;
}
