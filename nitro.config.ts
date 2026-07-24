import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineNitroConfig } from "nitro/config";
import { loadConfig } from "c12";
import { vercel } from "./src/server/vercel";
import { bundleDocs } from "./src/server/bundle-docs";
import { rebaseOutput } from "./src/server/rebase-output";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Dev vs prod. `pnpm dev` / `undocs dev` run Vite in development (NODE_ENV
// "development"); `pnpm build` / `undocs build` set NODE_ENV="production". The
// dev-only content live-reload (WS handler + fs-watch plugin + Nitro websocket
// feature) is registered ONLY when this is false, so prod output stays clean.
const dev = process.env.NODE_ENV !== "production";

// Docs directory. The CLI (`undocs dev|build <dir>`) sets `UNDOCS_DIR` to the
// absolute docs dir before invoking Vite; a bare `pnpm dev` (no CLI) falls back
// to the repo `./docs` so local theme development still works.
const docsDir = process.env.UNDOCS_DIR ? resolve(process.env.UNDOCS_DIR) : r("./docs");

// Its config lives at `<docsDir>/.config/docs.yaml` and is loaded here via c12
// (nitro.config.ts is a module we control, so config-time loading keeps
// runtimeConfig in sync).
const { config: docs } = await loadConfig<any>({ name: "docs", cwd: docsDir });

// Mirror the CLI: `dir` is resolved relative to the docs cwd (falls back to the
// docs dir itself when the config omits it).
const dir = resolve(docsDir, docs.dir || ".");
const llms = (docs.llms || {}) as any;

// Root(s) for the Vercel post-build link step. `rebaseOutput` now writes the
// real `.vercel/output` INTO the docs dir, so we no longer symlink it back to
// `docsDir` (that's where it already lives) — we only need to expose it at the
// WORKSPACE root, i.e. the dir Vercel actually runs the build from
// (`process.cwd()`), for the case where the docs project is a subdir of the
// configured "Root Directory" (Vercel looks for `.vercel/output` at the build
// root, not inside `docsDir`). When the build root IS the docs dir, `linkOutput`'s
// `target === source` guard no-ops. `vercel` self-guards to the vercel preset, so
// this is harmless for the default node-server build.
const vercelLinkDirs = [process.cwd()];

// Static asset dirs served at the site root. The app-config `logo` is
// `/icon.svg`; the docs may override it with their own copy under
// `<docsDir>/.docs/public`. Order: docs public first (docs-specific overrides),
// then the app defaults (`icon.svg`/`robots.txt`/`unjs.svg`). Existing dirs only.
const docsPublicDir = resolve(docsDir, ".docs/public");
const publicAssets = [
  existsSync(docsPublicDir) ? { dir: docsPublicDir, maxAge: 0 } : undefined,
  { dir: r("./src/app/public"), maxAge: 0 },
].filter(Boolean) as { dir: string; maxAge: number }[];

// Server assets for the dynamic OG-image route (`/_og/**`): Public Sans fonts +
// the UnJS fallback mark (`og-image`), plus app default and docs-override
// public dirs (`og-public`/`og-docs`) so the card can use a project's own
// `icon.svg`. Storage mounts (`assets/<baseName>`), distinct from `publicAssets`.
const serverAssets = [
  { baseName: "og-image", dir: r("./src/server/og-assets") },
  { baseName: "og-public", dir: r("./src/app/public") },
  ...(existsSync(docsPublicDir) ? [{ baseName: "og-docs", dir: docsPublicDir }] : []),
];

export default defineNitroConfig({
  // No hardcoded preset: Nitro auto-detects from the environment (`NITRO_PRESET`
  // / `VERCEL` / …), falling back to `node-server`. This lets a Vercel build
  // resolve the `vercel` preset (producing `.vercel/output`, which the `vercel`
  // module then exposes), while a plain `pnpm build` stays on `node-server`.

  // Dev-only: enable Nitro's WebSocket support so the `/api/docs/_ws` handler
  // below can upgrade. Left off in prod (no WS handler is registered there).
  features: dev ? { websocket: true } : {},

  // `vercel`: post-build step adding markdown content-negotiation routes and
  // symlinking `.vercel`/`dist` output into Vercel's expected roots. No-op
  // unless the vercel preset is active.
  //
  // `bundleDocs` (TEMPORARY, prod-only): copies docs `.md`/`.yml` into
  // `<output>/server/docs` so deploys don't depend on the build machine's docs dir.
  //
  // `rebaseOutput`: `rootDir` must stay `pkgRoot` (config + builder resolution),
  // so preset output would otherwise land next to undocs; this rebases
  // `output.*` onto `docsDir` instead. Listed first so its `setup` runs before
  // other modules' `compiled` hooks read those paths.
  modules: [rebaseOutput(docsDir), vercel(vercelLinkDirs), bundleDocs(dir)],

  // SSR serving: no `renderer.template` or `renderer.handler` is set. With an
  // `ssr` Vite environment present (see `vite.config.ts`), Nitro's vite plugin
  // auto-wires its internal ssr-renderer to that environment's `fetch` handler —
  // `src/app/entry-server.ts` — which server-renders `app.vue` and inlines the
  // hydration payload consumed by the client bundle.

  // Serve docs/app static files (icon.svg, robots.txt, unjs.svg, ...) at the
  // site root. Copied into `.output/public` at build time and served by the
  // node-server preset.
  publicAssets,

  // Bundled asset dirs for the OG-image route, mounted as `assets/<baseName>`
  // storage (fonts, fallback mark, public icon overrides). See above.
  serverAssets,

  // NOTE: no `rollupConfig.external`/`traceDeps` for md4x/shiki/automd — their
  // WASM entries are bundled inline by Nitro's unwasm plugin, keeping
  // `.output/` self-contained (no project `node_modules`). Externalizing them
  // would break that; Nitro still auto-traces genuine native deps (e.g.
  // @parcel/watcher) on its own.

  // Force md4x to be BUNDLED so unwasm's `.wasm?module` transform runs on it:
  // `md4x/wasm` resolves via the `unwasm` condition to a `?module` import only
  // unwasm can handle. The prerender's rolldown pass previously externalized
  // md4x while still applying that condition, leaving the raw import to hit
  // plain Node → `ERR_PACKAGE_PATH_NOT_EXPORTED`. `noExternals` keeps md4x
  // inline everywhere (like shiki).
  noExternals: ["md4x"],

  // Explicit server-route registrations. `serverDir` defaults to `false` in
  // Nitro v3, so nothing under `src/server/` is auto-scanned — only these
  // handlers register. Each points at the h3 content handler.
  handlers: [
    // Redirect bare `/path/to/route.md` → `/raw/path/to/route.md`. Runs as
    // middleware before the matched handler; self-guards on `.md` suffix and
    // skips paths already under `/raw/`.
    {
      route: "/**",
      middleware: true,
      handler: r("./src/server/middleware/raw-redirect.ts"),
    },
    {
      route: "/api/docs/page/**:path",
      method: "GET",
      handler: r("./src/server/routes/api/docs/page/[...path].get.ts"),
    },
    {
      // `.json` suffix: these param-less routes bake to static files at
      // prerender, and Vercel serves extensionless static files as
      // `application/octet-stream` (ofetch gets a Blob, not JSON). The
      // extension pins content-type to `application/json`; must match the
      // client URL in `useContent.ts` and the prerender hint in `app.vue`.
      route: "/api/docs/navigation.json",
      method: "GET",
      handler: r("./src/server/routes/api/docs/navigation.get.ts"),
    },
    {
      route: "/api/docs/search.json",
      method: "GET",
      handler: r("./src/server/routes/api/docs/search.get.ts"),
    },
    {
      // `.json` for the same reason as navigation/search above (baked to a
      // static file at prerender; keeps the served content-type as JSON).
      route: "/api/docs/blog.json",
      method: "GET",
      handler: r("./src/server/routes/api/docs/blog.get.ts"),
    },
    {
      route: "/api/docs/sponsors",
      method: "GET",
      handler: r("./src/server/routes/api/docs/sponsors.get.ts"),
    },
    {
      route: "/api/docs/contributors",
      method: "GET",
      handler: r("./src/server/routes/api/docs/contributors.get.ts"),
    },
    {
      route: "/api/_content",
      method: "GET",
      handler: r("./src/server/routes/api/_content.get.ts"),
    },
    {
      route: "/raw/**:slug",
      method: "GET",
      handler: r("./src/server/routes/raw/[...slug].get.ts"),
    },
    { route: "/llms.txt", method: "GET", handler: r("./src/server/routes/llms.txt.get.ts") },
    {
      route: "/llms-full.txt",
      method: "GET",
      handler: r("./src/server/routes/llms-full.txt.get.ts"),
    },
    { route: "/_og/**", method: "GET", handler: r("./src/server/routes/_og/[...slug].get.ts") },
    ...(dev ? [{ route: "/api/docs/_ws", handler: r("./src/server/dev-ws.ts") }] : []),
  ],

  // Dev-only Nitro plugins. The content live-reload watcher (fs.watch on the
  // docs dir → invalidate index + broadcast reload) is registered here in dev
  // only, so `.output/server` never contains it.
  plugins: dev ? [r("./src/server/dev-watch.ts")] : [],

  // ISR everything by default. Query-reading routes need explicit `passQuery`+
  // `allowQuery` so the cache key includes exactly the params read — otherwise
  // distinct requests (e.g. `?path=/a` vs `?path=/b`) would collide, while the
  // allow-list stops unrelated params (utm_*, …) fragmenting the cache.
  // `/api/_content` is excluded — its `?fresh` forces a cold rebuild, which
  // caching would defeat.
  routeRules: {
    "/**": { isr: true },
    "/api/_content": { isr: false },
    "/_og/**": { isr: true },
  },

  runtimeConfig: {
    // Read by the content store (`src/server/content/store.ts`) and the llms
    // routes via the real Nitro `useRuntimeConfig()`.
    undocs: {
      dir,
      automd: docs.automd,
      url: docs.url || "",
      // Site name for the OG-image kicker (`src/server/routes/_og/[...slug].get.ts`).
      name: docs.name || "",
      // Theme color for the OG-image card (`src/server/routes/_og/[...].get.ts`);
      // maps a Tailwind color name → hex, or passes a raw color through.
      themeColor: docs.themeColor || "",
      sponsorsAPI: docs.sponsors?.api || "",
      // `owner/repo` slug, read by the contributors proxy route to build the
      // upstream ungh.cc URL server-side.
      github: docs.github || "",
      title: llms.title || docs.name || "",
      description: llms.description || docs.description || "",
      llmsFull: {
        title: llms.full?.title || docs.name || "",
        description: llms.full?.description || docs.description || "",
      },
    },
  },

  // Prerender. Crawl from `/` following in-page `<a href>` links to bake every
  // reachable doc page. `routes` seeds entrypoints the crawler can't discover:
  // `/` (crawl root) and `/llms.txt`/`/llms-full.txt` (generated but unlinked).
  // Prerendered pages also emit an `x-nitro-prerender` response header
  // (`src/app/entry-server.ts`) hinting query-less routes crawlLinks can't find
  // via `<a href>`: `/api/docs/navigation`+`/search` (the page's content JSON),
  // `/_og/<path>.png` (its OG-image, path-addressed so Nitro can write it to
  // disk), and `/raw/<path>.md` (its source markdown).
  //
  // `ignore` keeps dynamic/per-request routes from baking.
  prerender: {
    crawlLinks: true,
    routes: ["/", "/llms.txt", "/llms-full.txt"],
    ignore: [],
  },
});
