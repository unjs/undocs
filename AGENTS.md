# AGENTS.md

`undocs` — the UnJS documentation generator. A standalone **Nitro v3 + Vite +
Vue** app that renders a docs site from a directory of Markdown. It ships as a
CLI (`undocs dev` / `undocs build`) that a docs project depends on; the docs
project supplies only Markdown + one config file.

## Stack

- **Nitro v3** server — SSR-renders the app and serves the `/api/docs/*` content
  API. Preset auto-detected (`node-server` default, `vercel` on Vercel).
- **Vite** with two environments — `client` (browser bundle → `.output/public`)
  and `ssr` (`entry-server.ts`, whose `fetch` Nitro auto-wires as the renderer).
- **From-scratch router** (`src/app/router.ts`) instead of vue-router — a tiny
  reactive route + `AppLink`/`AppPage`/`AppLayout`, animating client navigations
  via the native View Transitions API.
- **`reka-ui`** (unstyled primitives) + **Tailwind v4** (`@tailwindcss/vite`).
- **`md4x`** (Markdown → comark AST) + **shiki** (highlight), both server-only.

## Layout (`src/`)

### `src/app/**` — CLIENT (browser + SSR render)

- `main.ts` — client entry: seed stores from the payload → `createSSRApp` →
  hydrate `#root`. `entry-server.ts` — the SSR renderer.
- `router.ts` — `createAppRouter(history?)`, `useRoute`/`useRouter`,
  `createWebHistory`/`createMemoryHistory`. Static first-match route table with a
  mandatory trailing catch-all (docs page).
- `app.config.ts` — the **theme** defaults (`defineAppConfig`).
- `composables/` — `useAsyncData` (+`useLazyAsyncData`/`refreshAppData`), `useState`,
  `createError`, `useColorMode`, `useAppConfig`, `useRuntimeConfig` (client stub),
  plus content/query helpers (`useContent`, `useDocsNav`, `useDocsSearch`, …).
  `useHead`/`useSeoMeta` come from `@unhead/vue`.
- `components/app/` — the framework shims: `AppLink` (link + external `<a>`),
  `AppPage` (per-page `<Suspense>`, keyed by `route.path`), `AppLayout`
  (`route.meta.layout` resolver), `ClientOnly`. Other `components/` subdirs are UI.
- `content/` — `MarkdownRenderer.ts` (renders the comark AST to Vue via an
  explicit tag→component registry) + prose components.
- `layouts/`, `pages/`, `utils/`, `assets/`, `public/`.
- `ssr/` — the SSR state bridge: `server-context.ts` (per-request store via
  AsyncLocalStorage) and `payload.ts` (`window.__UNDOCS__` serialize/read).
- `env.d.ts` — types the `import.meta.{server,client,dev,prerender}` build flags
  and the `virtual:undocs/app-config` module.

### `src/server/**` — NITRO (node-only)

- `content/` — the content engine. `buildIndex()` (`builder.ts`) globs the docs
  dir, parses each file with `md4x`, runs block `transforms`, highlights with
  `shiki`, builds navigation/search/TOC/surround, and returns a `ContentIndex`.
  `store.ts` caches that index as a process singleton. `highlight.ts`, `icons.ts`,
  `types.ts`, `utils.ts` support it.
- `routes/api/docs/` — the content API (see below). Other routes: `raw/**` and
  `llms{,-full}.txt` (source Markdown for LLMs), `_og/**` (OG images via
  `takumi-js`), `_content` (build-stats debug page).
- `app-config.ts` — `generateAppConfig(docsDir)`: loads `.config/docs.*` via
  **c12**, renders landing markdown/hero code, returns the client app-config.
- Nitro modules/plugins: `bundle-docs.ts` (copies docs into the prod output),
  `vercel.ts` (Vercel output wiring), and dev-only live-reload
  (`dev-watch`/`dev-ws`/`dev-reload`).

### Root

`nitro.config.ts`, `vite.config.ts`, `cli/` (citty CLI), `schema/` (the docs
config JSON Schema + `.d.ts`), `docs/` (the repo's own docs, the default target),
`template/` (starter scaffold), `test/`.

## Commands

```bash
pnpm dev                       # vite dev on ./docs (:3000)
pnpm build                     # vite build → docs/.output/{public,server}
pnpm start                     # node docs/.output/server/index.mjs (:3000)
node cli/main.mjs dev  <dir>   # dev on an arbitrary docs dir (sets UNDOCS_DIR)
node cli/main.mjs build <dir>  # prod build → <dir>/.output
pnpm test                      # vitest run --coverage
pnpm typecheck                 # tsc --noEmit  (bare tsc: .vue imports don't resolve)
pnpm lint                      # oxlint && oxfmt --check   (fix: pnpm fmt)
```

The CLI sets `UNDOCS_DIR` (default `.`); `nitro.config.ts` and `vite.config.ts`
both read it, falling back to `./docs`. `pkgRoot` is resolved from
`import.meta.url` and used as Vite's `root`/`configFile`, so an installed bin
always loads OUR config, not the user's cwd. Because Vite's `root` is `pkgRoot`,
Nitro's `rootDir` is `pkgRoot` too — so its preset-derived output would land next
to undocs. The `rebaseOutput` nitro module (`src/server/rebase-output.ts`)
relocates that output tree onto `docsDir`, so the build always writes to
`<docsDir>/.output` (or the preset's equivalent). See the invariant below.

## The content API (the HTTP boundary)

Pages fetch content over HTTP — never by importing the engine. `useContent`'s
`docFetch()` → `$fetch("/api/docs/*")` → the Nitro route → `store`/`builder`:

- `/api/docs/page/<path>.json` — one `DocPage` (404 if missing), with its
  `[prev, next]` `surround` embedded (so a page render is a single request)
- `/api/docs/navigation` — the nav tree
- `/api/docs/search` — search sections
- `/api/docs/blog.json` — the `/blog/` listing, newest-first (query-less so it
  prerenders to disk)
- `/api/docs/{contributors,sponsors}` — same-origin proxies (cached, last-good
  fallback) to ungh / the sponsors API

On the server this `$fetch` is request-scoped (Nitro internal `$fetch` if present,
else a same-origin loopback); it does not forward the incoming request's
cookies/headers (fine for these public routes).

## Config flow (two configs, merged)

1. **Theme** — `src/app/app.config.ts` (defaults shipped with undocs).
2. **User** — the docs project's `.config/docs.*`, loaded by c12 in
   `generateAppConfig` and exposed to the client as the build-time virtual module
   `virtual:undocs/app-config` (the `undocs:app-config` Vite plugin). Generated
   **once per build**; dev watches `.config` and full-reloads on change.

`useAppConfig()` merges them once: `defu(userConfig, themeConfig)` — user wins,
theme-only keys survive. The docs config shape is defined in `schema/config.json`
(+ `config.d.ts`); docs YAML points its `$schema` at the published copy.

## Invariants (do not break)

- **HTTP boundary.** node/wasm deps (`md4x`, `shiki`, `automd`, `takumi-js`,
  `node:*`, `c12`) live only under `src/server/`. The client reaches content
  solely through `/api/docs/*` and `virtual:undocs/app-config`. Verify no engine
  import leaks into the client bundle.
- **Per-request state on the server.** The server renders many requests
  concurrently in one process. Never add module-level mutable state to
  `src/app/**` code that runs during render — put it on the ALS
  `UndocsServerContext` (`ssr/server-context.ts`), or key it so the client
  reproduces it. `server-context.ts` is node-only; composables touch it only
  inside `import.meta.server` branches (DCE'd from the client bundle). (The
  content `ContentIndex` and proxy caches in `src/server/` are process singletons
  — that's correct there: server-only, visitor-independent.)
- **Hydration parity.** The SSR render and the client's _first_ render must
  produce identical DOM. Defer `localStorage`/color-mode/random/time reads to
  `onMounted` or route them through the seeded payload; fence browser-only code
  with `import.meta.client` (or `!import.meta.server`) and node-only with
  `import.meta.server`. Payload seeding (`hydrateAsyncData`/`hydrateState`/
  `seedClientIcons`) MUST run before `createSSRApp`.
- **Raw HTML is resolved server-side.** `transforms.ts`'s `liftRawHtml` turns raw
  HTML into `_html` nodes (md4x can't distinguish a real tag from a literal `<`);
  the client injects them with `v-html`. Moving this client-side breaks escaping
  and security.
- **Router uses a runtime `typeof window` check** (`IS_BROWSER`), not
  `import.meta.client` — the latter is `undefined` in the dev browser and would
  pick memory history on the client, breaking hydration and View Transitions.
- **View-Transition safety.** `AppPage`'s `<Suspense>` `onResolve` must call
  `router._pageRendered()`, and the `VT_HOLD_TIMEOUT` cap must stay, or a slow/
  errored page can freeze the transition frame.
- **Single shared highlighter.** Doc content and the landing hero both go through
  the one `highlightCode`/shiki instance. Its fine-grained `.mjs` lang/theme
  imports and `shiki/core` + oniguruma-only setup are deliberate (avoid rolldown
  bloat/panic).
- **Prod docs-dir fallback.** The baked absolute `runtimeConfig.undocs.dir` may
  not exist on a deploy; `store.ts`'s `resolveDir` falls back to
  `<nitro-main>/docs`, populated by `bundle-docs.ts`. Keep the two glob/exclude
  rules in sync.
- **Output lives in the docs dir, via rebase — not `rootDir`.** Nitro's `rootDir`
  MUST stay `pkgRoot`: it drives both c12 config discovery (finding our
  `nitro.config.ts`) and builder-package resolution (`vite` is undocs's dep, not
  the docs project's). Repointing `rootDir` at `docsDir` breaks both. To still
  write output into the docs project, `rebaseOutput` (`src/server/rebase-output.ts`,
  first in `modules`) rewrites `output.{dir,publicDir,serverDir}` from the
  `pkgRoot` base to `docsDir` in its `setup` — preserving the preset's shape
  (never a hardcoded `output.*` override). It runs before the `vercel`/`bundleDocs`
  `compiled` hooks that read those paths.
- **Dev-only stays dev-only.** `dev-watch`/`dev-ws`/`dev-reload` and
  `metaEnvFlagsDev` must never ship in `.output/server`.

## Build flags

`import.meta.{server,client,dev,prerender}` are compile-time constants
(`define` per Vite env in `vite.config.ts`), so opposite branches DCE. **Dev
caveat:** Vite doesn't apply these `define`s to dev-served browser modules, so
the `metaEnvFlagsDev` plugin (dev-only, `enforce: "post"`) does the token
replacement itself. Keep it. Prefer `!import.meta.server` for client checks (robust
even without the plugin).

## Testing

`test/api.test.ts` exercises every Nitro route via its h3 `.fetch(Request)`
against an on-disk fixture — no running server. `test/content/*` unit-tests the
engine (builder, highlight, icons, store, transforms, utils). Run `pnpm test`.

## Conventions

- Formatter/linter is **oxlint + oxfmt** — run `pnpm fmt` before finishing.

## Deferred

Not yet ported: prerender/SSG (see `usePageSEO.ts`'s `prerenderRoutes` TODO) and
Plausible analytics.
