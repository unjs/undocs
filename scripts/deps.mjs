#!/usr/bin/env node
// Discover the import/dependency graph between app components (src/app/**).
//
// Nodes  = every .vue / .ts / .tsx file under src/app.
// Edges  = static `import ... from "..."` and dynamic `import("...")`.
// Aliases resolved: `@app` -> src/app, `@server` -> src/server.
//
// Registration is also annotated per node:
//   - `markdown-global`: reachable from a markdown tag via the COMPONENTS map
//     in content/MarkdownRenderer.ts (authored in `.md`, not imported by pages).
//   - `lazy`: pulled in via `defineAsyncComponent(() => import(...))` or a bare
//     dynamic `import(...)` (code-split), vs. a static top-level import.
//
// Usage:
//   node scripts/deps.mjs            # human-readable summary + orphans + globals
//   node scripts/deps.mjs --json     # full graph as JSON
//   node scripts/deps.mjs --dot      # graphviz DOT (pipe to `dot -Tsvg`)

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const APP = join(ROOT, "src/app");
const SERVER = join(ROOT, "src/server");
const COMPONENTS = join(APP, "components");
const EXTS = [".vue", ".ts", ".tsx", ".mts", ".js", ".mjs"];
// Extension-probe order for *extensionless* specifiers. Mirrors Vite: `.vue` is
// NEVER auto-appended (SFCs are always imported with an explicit `.vue`), so a
// bare `./Button` must resolve to `Button.ts`, not a same-named `Button.vue`.
const RESOLVE_EXTS = [".ts", ".mts", ".tsx", ".js", ".mjs", ".vue"];

// Scope the graph to component-to-component edges only.
const inScope = (f) => f.startsWith(COMPONENTS);

// --- collect source files ------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "_deferred") continue;
      walk(p, out);
    } else if (EXTS.includes(extname(p))) {
      out.push(p);
    }
  }
  return out;
}

// Walk the whole app (needed to resolve edges + entry reachability), but the
// graph we report on is scoped to `src/app/components/**`.
const files = walk(APP);
const comps = files.filter(inScope);

// --- resolve a raw specifier to a file path (or null if external) --------
function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith("@app/")) base = join(APP, spec.slice(5));
  else if (spec.startsWith("@server/")) base = join(SERVER, spec.slice(8));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return { external: true, spec }; // bare pkg / virtual module

  // Try exact (explicit-extension imports win), then extension probing in
  // Vite's order, then /index.*
  const cands = [
    base,
    ...RESOLVE_EXTS.map((e) => base + e),
    ...RESOLVE_EXTS.map((e) => join(base, "index" + e)),
  ];
  for (const c of cands) {
    if (existsSync(c) && statSync(c).isFile()) return { file: c };
  }
  return { unresolved: true, spec };
}

// --- parse imports out of a file -----------------------------------------
const IMPORT_RE = /import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_RE = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

const graph = new Map(); // file -> { imports: Set, lazyImports: Set, externals: Set, unresolved: Set }

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const node = { imports: new Set(), lazy: new Set(), externals: new Set(), unresolved: new Set() };
  for (const m of src.matchAll(IMPORT_RE)) add(m[1], false);
  for (const m of src.matchAll(DYNAMIC_RE)) add(m[1], true);
  graph.set(f, node);

  function add(spec, isDynamic) {
    const r = resolveSpec(spec, f);
    if (r.file) (isDynamic ? node.lazy : node.imports).add(r.file);
    else if (r.external) node.externals.add(r.spec);
    else if (r.unresolved) node.unresolved.add(r.spec);
  }
}

// --- registration: markdown-global components ----------------------------
const mdGlobals = new Set();
const mdRenderer = join(APP, "content/MarkdownRenderer.ts");
if (existsSync(mdRenderer)) {
  const node = graph.get(mdRenderer);
  // Components imported by MarkdownRenderer are the markdown-reachable registry.
  if (node) for (const dep of node.imports) if (dep.endsWith(".vue")) mdGlobals.add(dep);
}

// --- reverse edges + reachability ----------------------------------------
const importers = new Map(); // file -> Set of files that import it (static or lazy)
for (const f of files) importers.set(f, new Set());
for (const [f, n] of graph) {
  for (const dep of [...n.imports, ...n.lazy]) importers.get(dep)?.add(f);
}

// Entry points: things loaded outside the component graph.
const ENTRIES = [
  "main.ts",
  "entry-server.ts",
  "app.vue",
  "error.vue",
  "content/MarkdownRenderer.ts",
]
  .map((p) => join(APP, p))
  .filter(existsSync);

const reachable = new Set();
(function mark(stack) {
  while (stack.length) {
    const f = stack.pop();
    if (reachable.has(f)) continue;
    reachable.add(f);
    const n = graph.get(f);
    if (n) stack.push(...n.imports, ...n.lazy);
  }
})([...ENTRIES, ...mdGlobals]);

// --- output (scoped to src/app/components/**) ----------------------------
const arg = process.argv[2];
// Component -> component edges only. `rel` shortened to the components subtree.
const crel = (p) => relative(COMPONENTS, p);
const compDeps = (n, key) => [...n[key]].filter(inScope);
const compImporters = (f) => [...importers.get(f)].filter(inScope);

if (arg === "--json") {
  const out = {};
  for (const f of comps) {
    const n = graph.get(f);
    out[crel(f)] = {
      imports: compDeps(n, "imports").map(crel),
      lazy: compDeps(n, "lazy").map(crel),
      importedBy: compImporters(f).map(crel),
      markdownGlobal: mdGlobals.has(f),
      reachable: reachable.has(f),
    };
  }
  console.log(JSON.stringify(out, null, 2));
} else if (arg === "--dot") {
  console.log("digraph components {");
  console.log("  rankdir=LR; node [shape=box,fontsize=9];");
  for (const g of mdGlobals)
    if (inScope(g)) console.log(`  "${crel(g)}" [style=filled,fillcolor=lightblue];`);
  for (const f of comps) {
    const n = graph.get(f);
    for (const dep of compDeps(n, "imports")) console.log(`  "${crel(f)}" -> "${crel(dep)}";`);
    for (const dep of compDeps(n, "lazy"))
      console.log(`  "${crel(f)}" -> "${crel(dep)}" [style=dashed,color=red];`);
  }
  console.log("}");
} else {
  const line = "─".repeat(60);
  console.log(
    `\n${line}\nCOMPONENT GRAPH — ${comps.length} files under src/app/components\n(edges = component→component imports only)\n${line}`,
  );

  // Most-depended-on within components (fan-in).
  const byFanIn = comps
    .map((f) => [f, compImporters(f).length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.log("\n▸ Most imported by other components (fan-in):");
  for (const [f, c] of byFanIn) if (c) console.log(`   ${String(c).padStart(3)}  ${crel(f)}`);

  // Biggest component importers (fan-out).
  const byFanOut = comps
    .map((f) => [f, compDeps(graph.get(f), "imports").length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("\n▸ Imports the most other components (fan-out):");
  for (const [f, c] of byFanOut) if (c) console.log(`   ${String(c).padStart(3)}  ${crel(f)}`);

  // Markdown-global components (registered in MarkdownRenderer, authored in .md).
  const mdInComps = [...mdGlobals].filter(inScope).sort();
  console.log(`\n▸ Markdown-global components (registered in MarkdownRenderer):`);
  for (const g of mdInComps) console.log(`   ● ${crel(g)}`);

  // Lazy / code-split edges between components.
  const lazyEdges = [];
  for (const f of comps) for (const dep of compDeps(graph.get(f), "lazy")) lazyEdges.push([f, dep]);
  console.log(`\n▸ Lazy / dynamic-import edges between components (${lazyEdges.length}):`);
  for (const [f, dep] of lazyEdges) console.log(`   ${crel(f)} ⇢ ${crel(dep)}`);

  // Leaf components — import no other component.
  const leaves = comps.filter((f) => compDeps(graph.get(f), "imports").length === 0);
  console.log(`\n▸ Leaf components (import no other component) — ${leaves.length}`);

  // Orphan components — not reachable from any app entry point.
  const orphans = comps.filter((f) => !reachable.has(f));
  console.log(`\n▸ Unreachable from app entry points (${orphans.length}):`);
  for (const f of orphans.sort()) console.log(`   ✗ ${crel(f)}`);
  console.log();
}
