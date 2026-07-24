import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import MiniSearch from "minisearch";
import type { Options, SearchOptions, SearchResult } from "minisearch";
import { buildIndex } from "../../src/server/content/builder";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  toSearchDocuments,
} from "../../src/server/content/search-options";
import type { SearchDocument } from "../../src/server/content/search-options";
import type { SearchSection } from "../../src/server/content/types";

// ============================================================================
// Search-relevance tuning harness (NOT a pass/fail unit test — a benchmark).
//
// It builds the real content index for Nitro's shipped docs
// (`node_modules/nitro/dist/docs`), then runs a corpus of realistic queries
// through a MATRIX of {index-build profile} × {client-search profile} and
// scores each combination against hand-labelled ground truth. The point is to
// see, on real prose, which knobs actually move relevance — before committing a
// change to `search-options.ts`.
//
//   • Index-build profiles  → the index-time `Options` (tokenizer / processTerm
//     / indexed fields). Changing these requires a server rebuild AND an
//     identical client `loadJS`, so each profile is built THEN round-tripped
//     through toJSON()→loadJS() exactly like production.
//   • Search profiles       → the query-time `SearchOptions` (boost / prefix /
//     fuzzy / weights / bm25 / boostDocument). Free to tune, no rebuild.
//
// Metrics per combo, averaged over the corpus:
//   hit@1 / hit@3 / hit@5 — fraction of queries whose first RELEVANT result
//                            lands in the top 1 / 3 / 5.
//   MRR                    — mean reciprocal rank of the first relevant result
//                            (the headline number; higher = better).
//
// Tune by editing the three arrays below (SCENARIOS / INDEX_PROFILES /
// SEARCH_PROFILES) and reading the printed tables. `pnpm test search-tuning`.
// ============================================================================

const NITRO_DOCS = fileURLToPath(new URL("../../node_modules/nitro/dist/docs", import.meta.url));

// --- ground-truth corpus -----------------------------------------------------
// Each scenario: a query a real user might type, the page path(s) that would
// genuinely satisfy it, and a `kind` so the report can break results down by
// query style. A result is "relevant" if its section id resolves to one of
// `targets` (page-level id === path, heading ids are `path#slug`). Paths are the
// route paths undocs derives (numeric `N.` prefixes stripped).
type Kind = "exact" | "prefix" | "typo" | "identifier" | "natural" | "phrase";

interface Scenario {
  q: string;
  targets: string[];
  kind: Kind;
}

const SCENARIOS: Scenario[] = [
  // exact title words
  { q: "cache", targets: ["/docs/cache"], kind: "exact" },
  { q: "websocket", targets: ["/docs/websocket"], kind: "exact" },
  { q: "routing", targets: ["/docs/routing"], kind: "exact" },
  { q: "database", targets: ["/docs/database"], kind: "exact" },

  // as-you-type prefixes (fail without prefix search)
  { q: "stor", targets: ["/docs/storage"], kind: "prefix" },
  { q: "config", targets: ["/docs/configuration", "/config"], kind: "prefix" },
  { q: "life", targets: ["/docs/lifecycle"], kind: "prefix" },
  { q: "plug", targets: ["/docs/plugins"], kind: "prefix" },

  // typos (fail without fuzzy search)
  { q: "websockit", targets: ["/docs/websocket"], kind: "typo" },
  { q: "storrage", targets: ["/docs/storage"], kind: "typo" },
  { q: "routting", targets: ["/docs/routing"], kind: "typo" },
  { q: "pluggins", targets: ["/docs/plugins"], kind: "typo" },

  // API identifiers (camelCase; stress the tokenizer)
  { q: "useStorage", targets: ["/docs/storage"], kind: "identifier" },
  { q: "defineCachedEventHandler", targets: ["/docs/cache"], kind: "identifier" },
  { q: "defineCachedFunction", targets: ["/docs/cache"], kind: "identifier" },
  { q: "defineNitroPlugin", targets: ["/docs/plugins"], kind: "identifier" },
  { q: "defineTask", targets: ["/docs/tasks"], kind: "identifier" },
  { q: "defineWebSocketHandler", targets: ["/docs/websocket"], kind: "identifier" },
  {
    q: "useRuntimeConfig",
    targets: ["/docs/configuration", "/examples/runtime-config"],
    kind: "identifier",
  },
  // subword of a camelCase identifier — the case the default tokenizer misses
  { q: "cached handler", targets: ["/docs/cache"], kind: "identifier" },
  { q: "web socket handler", targets: ["/docs/websocket"], kind: "identifier" },

  // natural language / synonyms / multi-word
  {
    q: "environment variables",
    targets: ["/docs/configuration", "/examples/runtime-config"],
    kind: "natural",
  },
  { q: "kv storage", targets: ["/docs/storage"], kind: "natural" },
  { q: "cached function", targets: ["/docs/cache"], kind: "natural" },
  { q: "scheduled tasks cron", targets: ["/docs/tasks"], kind: "natural" },
  {
    q: "route rules",
    targets: ["/docs/routing", "/config", "/docs/lifecycle"],
    kind: "natural",
  },
  { q: "deploy to vercel", targets: ["/deploy/providers/vercel"], kind: "natural" },
  { q: "api routes", targets: ["/examples/api-routes", "/docs/routing"], kind: "natural" },

  // exact multi-word phrases
  { q: "quick start", targets: ["/docs/quick-start"], kind: "phrase" },
  { q: "server entry", targets: ["/docs/server-entry"], kind: "phrase" },
];

// --- index-build profiles (index-time Options) -------------------------------
// The library default tokenizer splits on whitespace + Unicode punctuation
// (which already breaks `foo.bar`, `use_x`, `use-x`) but leaves camelCase whole.
const SPLIT = /[\n\r\p{Z}\p{P}]+/u;

// Split camelCase into sub-words ONLY (drop the joined compound), so a query for
// `plugin` reaches `defineNitroPlugin` and `defineCachedEventHandler` still works
// under AND. This mirrors the shipped `tokenizeSearch`.
function identifierTokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(SPLIT)) {
    if (!raw) continue;
    const parts = raw.split(/(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
    if (parts.length > 1) out.push(...parts);
    else out.push(raw);
  }
  return out;
}

// Contrast variant: keep BOTH the compound AND its sub-words. Included to show
// WHY the shipped tokenizer drops the compound — this one breaks identifier
// queries under `combineWith: "AND"` (the compound term matches no document).
function identifierTokenizeKeepWhole(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(SPLIT)) {
    if (!raw) continue;
    out.push(raw);
    const parts = raw.split(/(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
    if (parts.length > 1) out.push(...parts);
  }
  return out;
}

const BASE_STORE = ["id", "title", "titles", "level", "preview"];

interface IndexProfile {
  name: string;
  options: Options<SearchDocument>;
}

const INDEX_PROFILES: IndexProfile[] = [
  {
    // The pre-tuning config: default tokenizer, title+content. Kept as the "before"
    // reference the guardrail measures the shipped config against.
    name: "baseline",
    options: { idField: "_id", fields: ["title", "content"], storeFields: BASE_STORE },
  },
  {
    // The ACTUAL shipped index-time options (identifier tokenizer). Pairing
    // "shipped" here with "shipped" below reproduces production exactly, so this
    // benchmark self-verifies whatever is committed to `search-options.ts`.
    name: "shipped",
    options: MINISEARCH_OPTIONS,
  },
  {
    // Also index the breadcrumb parents so a parent page name can pull up its
    // child sections.
    name: "with-titles",
    options: {
      idField: "_id",
      fields: ["title", "content", "titles"],
      storeFields: BASE_STORE,
    },
  },
  {
    // Identifier-aware tokenizer (camelCase → sub-words only), title+content.
    // Mirrors the shipped `tokenizeSearch`.
    name: "ident-tok",
    options: {
      idField: "_id",
      fields: ["title", "content"],
      storeFields: BASE_STORE,
      tokenize: identifierTokenize,
    },
  },
  {
    // The rejected variant that also keeps the compound token — kept in the
    // matrix so the report shows it collapsing under AND search.
    name: "ident+whole",
    options: {
      idField: "_id",
      fields: ["title", "content"],
      storeFields: BASE_STORE,
      tokenize: identifierTokenizeKeepWhole,
    },
  },
];

// --- client-search profiles (query-time SearchOptions) -----------------------
// Free to tune with no rebuild. `boostDocument` favours page-level sections
// (level 1) so a whole-page hit outranks a deep heading of equal text score.
const favorPages = (_id: unknown, _t: string, stored?: Record<string, unknown>) =>
  stored && stored.level === 1 ? 1.6 : 1;

interface SearchProfile {
  name: string;
  options: SearchOptions;
}

const SEARCH_PROFILES: SearchProfile[] = [
  {
    // The pre-tuning query options — the "before" reference for the guardrail.
    name: "current",
    options: { boost: { title: 2 }, prefix: true, fuzzy: 0.2, maxFuzzy: 4, combineWith: "AND" },
  },
  {
    // The ACTUAL shipped query-time options.
    name: "shipped",
    options: MINISEARCH_SEARCH_OPTIONS,
  },
  {
    // Same but OR — more forgiving on multi-word queries, noisier.
    name: "or",
    options: { boost: { title: 2 }, prefix: true, fuzzy: 0.2, maxFuzzy: 4, combineWith: "OR" },
  },
  {
    // Gate prefix/fuzzy to longer terms (cuts short-token noise), lean on exact
    // matches (lower fuzzy/prefix weights), reward page-level hits.
    name: "gated+pages",
    options: {
      boost: { title: 3 },
      prefix: (t: string) => t.length > 2,
      fuzzy: (t: string) => (t.length > 3 ? 0.2 : false),
      maxFuzzy: 4,
      combineWith: "AND",
      weights: { fuzzy: 0.3, prefix: 0.6 },
      boostDocument: favorPages,
      bm25: { k: 1.2, b: 0.5, d: 0.5 },
    },
  },
  {
    // Same gating but OR — best shot for loose natural-language queries.
    name: "gated+pages+or",
    options: {
      boost: { title: 3 },
      prefix: (t: string) => t.length > 2,
      fuzzy: (t: string) => (t.length > 3 ? 0.2 : false),
      maxFuzzy: 4,
      combineWith: "OR",
      weights: { fuzzy: 0.3, prefix: 0.6 },
      boostDocument: favorPages,
      bm25: { k: 1.2, b: 0.5, d: 0.5 },
    },
  },
];

// --- scoring -----------------------------------------------------------------
function rankOfFirstRelevant(hits: SearchResult[], targets: string[]): number {
  for (let i = 0; i < hits.length; i++) {
    const path = String((hits[i] as unknown as SearchDocument).id).split("#")[0];
    if (targets.includes(path)) return i + 1; // 1-based rank
  }
  return 0; // not found
}

interface ComboMetrics {
  index: string;
  search: string;
  "hit@1": number;
  "hit@3": number;
  "hit@5": number;
  MRR: number;
}

function pct(n: number, total: number): number {
  return Math.round((n / total) * 1000) / 1000;
}

// Build a MiniSearch the way production does: index → serialize → rehydrate. Any
// index-time option that doesn't round-trip through loadJS would surface here.
function buildRehydrated(
  sections: SearchSection[],
  profile: IndexProfile,
): MiniSearch<SearchDocument> {
  const ms = new MiniSearch<SearchDocument>(profile.options);
  ms.addAll(toSearchDocuments(sections));
  const serialized = ms.toJSON();
  return MiniSearch.loadJS<SearchDocument>(serialized, profile.options);
}

// ============================================================================
describe("search relevance tuning (Nitro docs corpus)", () => {
  let sections: SearchSection[];
  const indexes = new Map<string, MiniSearch<SearchDocument>>();

  beforeAll(async () => {
    if (!existsSync(NITRO_DOCS)) {
      throw new Error(`Nitro docs not found at ${NITRO_DOCS} — run \`pnpm install\`.`);
    }
    const index = await buildIndex({ dir: NITRO_DOCS });
    sections = index.search;
    for (const p of INDEX_PROFILES) indexes.set(p.name, buildRehydrated(sections, p));
  }, 120_000);

  it("indexes a non-trivial corpus", () => {
    expect(sections.length).toBeGreaterThan(50);
  });

  it("evaluates every {index × search} combo and prints a ranked report", () => {
    const total = SCENARIOS.length;
    const rows: ComboMetrics[] = [];
    // rank[query] per combo, plus a record of queries nothing could answer.
    const perScenario: Record<string, Record<string, number>> = {};
    for (const s of SCENARIOS) perScenario[s.q] = {};

    for (const ip of INDEX_PROFILES) {
      const ms = indexes.get(ip.name)!;
      for (const sp of SEARCH_PROFILES) {
        const comboKey = `${ip.name} / ${sp.name}`;
        let h1 = 0;
        let h3 = 0;
        let h5 = 0;
        let mrr = 0;
        for (const s of SCENARIOS) {
          const hits = ms.search(s.q, sp.options);
          const rank = rankOfFirstRelevant(hits, s.targets);
          perScenario[s.q][comboKey] = rank;
          if (rank === 1) h1++;
          if (rank >= 1 && rank <= 3) h3++;
          if (rank >= 1 && rank <= 5) h5++;
          if (rank >= 1) mrr += 1 / rank;
        }
        rows.push({
          index: ip.name,
          search: sp.name,
          "hit@1": pct(h1, total),
          "hit@3": pct(h3, total),
          "hit@5": pct(h5, total),
          MRR: Math.round((mrr / total) * 1000) / 1000,
        });
      }
    }

    rows.sort((a, b) => b.MRR - a.MRR);

    // eslint-disable-next-line no-console
    console.log(`\n=== ${total} scenarios · ${rows.length} combos (ranked by MRR) ===`);
    // eslint-disable-next-line no-console
    console.table(rows);

    // Per-kind MRR for the current baseline vs the top combo, so it's clear
    // WHERE a winning profile wins (identifiers? typos?) and whether it
    // regresses any query style.
    const best = rows[0];
    const baseKey = "baseline / current";
    const bestKey = `${best.index} / ${best.search}`;
    const kinds: Kind[] = ["exact", "prefix", "typo", "identifier", "natural", "phrase"];
    const byKind = kinds.map((kind) => {
      const group = SCENARIOS.filter((s) => s.kind === kind);
      const mrr = (key: string) =>
        Math.round(
          (group.reduce(
            (acc, s) => acc + (perScenario[s.q][key] ? 1 / perScenario[s.q][key] : 0),
            0,
          ) /
            group.length) *
            1000,
        ) / 1000;
      return {
        kind,
        n: group.length,
        [`MRR ${baseKey}`]: mrr(baseKey),
        [`MRR ${bestKey}`]: mrr(bestKey),
      };
    });
    // eslint-disable-next-line no-console
    console.log(`\n=== MRR by query kind: baseline vs best (${bestKey}) ===`);
    // eslint-disable-next-line no-console
    console.table(byKind);

    // Per-scenario ranks for baseline vs best (0 = not found in results).
    const diff = SCENARIOS.map((s) => ({
      query: s.q,
      kind: s.kind,
      [baseKey]: perScenario[s.q][baseKey] || "—",
      [bestKey]: perScenario[s.q][bestKey] || "—",
    }));
    // eslint-disable-next-line no-console
    console.log(`\n=== rank per query (baseline vs best); lower is better, — = miss ===`);
    // eslint-disable-next-line no-console
    console.table(diff);

    // Ground-truth audit: queries NO combo could answer in the top 5 usually
    // mean a mislabelled target, not a tuning gap — surface them loudly.
    const unanswerable = SCENARIOS.filter((s) =>
      Object.values(perScenario[s.q]).every((r) => r === 0 || r > 5),
    ).map((s) => s.q);
    if (unanswerable.length) {
      // eslint-disable-next-line no-console
      console.log(
        `\n⚠ no combo answered these in top-5 (check ground truth): ${unanswerable.join(", ")}`,
      );
    }

    // --- guardrails (loose; the tables are the deliverable) ---
    const baseline = rows.find((r) => r.index === "baseline" && r.search === "current")!;
    const shipped = rows.find((r) => r.index === "shipped" && r.search === "shipped")!;
    // The committed config must not lose top-5 recall vs the pre-tuning config,
    // and must not miss any identifier query (the misses the tuning fixed). If a
    // future edit to `search-options.ts` regresses this, this test fails loudly.
    expect(shipped["hit@5"]).toBeGreaterThanOrEqual(baseline["hit@5"]);
    const identMissedByShipped = SCENARIOS.filter(
      (s) => s.kind === "identifier" && !perScenario[s.q]["shipped / shipped"],
    ).map((s) => s.q);
    expect(identMissedByShipped).toEqual([]);
    // Lock the ONE disclosed trade of the tuning: identifier tokenization pushes
    // some exact-title hits off rank 1 (e.g. `cache` 1→2). That's fine for a
    // command palette AS LONG AS they stay in the top 3 — guard it so a future
    // edit can't silently deepen the regression into a scroll-to-find or a miss.
    const exactWorstRank = Math.max(
      ...SCENARIOS.filter((s) => s.kind === "exact").map(
        (s) => perScenario[s.q]["shipped / shipped"] || Infinity,
      ),
    );
    expect(exactWorstRank).toBeLessThanOrEqual(3);
  });
});
