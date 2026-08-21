import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import {
  undocsAppConfig,
  undocsUserTheme,
  undocsBuiltinIcons,
  excludeDocsFromTailwindDev,
  metaEnvFlagsDev,
  patchVueExclude,
  ssrEntryReloadDev,
} from "./vite.plugins.ts";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// `@vueuse/core` dir, resolved via Node (not a hardcoded `r("./node_modules/...")`)
// as the alias target below — pnpm installs deps as a SIBLING of the package
// dir, not nested inside it, so a hardcoded path only exists in the dev checkout.
const vueuseCoreDir = dirname(createRequire(import.meta.url).resolve("@vueuse/core/package.json"));

// Docs directory. Mirrors `nitro.config.ts`: the CLI (`undocs dev|build <dir>`)
// sets `UNDOCS_DIR`; a bare `pnpm dev` falls back to the repo `./docs`.
const docsDir = process.env.UNDOCS_DIR ? resolve(process.env.UNDOCS_DIR) : r("./docs");
const appDir = r("./src/app");

export default defineConfig((configEnv) => ({
  // `import.meta` flags shared by both envs. `server`/`client`
  // are set per-environment below; `dev`/`prerender` are mode-wide. Statically
  // replaced so `if (import.meta.server)` branches DCE out of the other bundle.
  define: {
    "import.meta.dev": JSON.stringify(configEnv.command !== "build"),
    "import.meta.prerender": "false",
  },

  // Disable Vite's own `publicDir`. Static assets (app defaults + the docs
  // project's `<docsDir>/.docs/public` overrides) are served solely through
  // Nitro's `publicAssets` (nitro.config.ts), in dev and prod alike — Vite's
  // public middleware runs BEFORE Nitro's, so pointing publicDir at
  // `src/app/public` used to shadow docs overrides (`/icon.svg` always
  // resolving to the shipped copy).
  publicDir: false,

  server: {
    fs: {
      // The docs project (and its `.docs/` theme layer) usually lives OUTSIDE the
      // Vite root (`pkgRoot`), so allow the dev server to serve user `.vue` files
      // that `virtual:undocs/user-*` imports by absolute path.
      allow: [r("."), docsDir],
    },
  },

  resolve: {
    // Force a single `vue` instance. When undocs is installed, its `src/**` lives
    // inside `node_modules` (resolving `vue` unoptimized) while a docs project's
    // `.docs/` theme components live outside it (pre-bundled) — two Vue copies,
    // breaking provide/inject (`useRoute` etc.). Harmless in the dev checkout.
    dedupe: ["vue"],
    alias: {
      // Convenience alias for importing the app sources by path. GLOBAL: both
      // the client (Vue app) and the Nitro/SSR server environment use `@app`.
      // Core `src/**` code uses this; the docs `.docs/` theme layer instead
      // uses the PUBLIC `undocs/src/*` subpath export (below) — the path a real
      // external consumer would use.
      "@app": r("./src/app"),
      "@shared": r("./src/shared"),
      "@server": r("./src/server"),

      // `@vueuse/core` (used directly + transitively by motion-v) is pinned
      // to a single resolved copy (`vueuseCoreDir`) so rolldown's stricter build
      // resolver doesn't duplicate Vue — the naive nested path doesn't exist when
      // undocs is installed (pnpm hoists it as a sibling).
      "@vueuse/core": vueuseCoreDir,
    },
  },

  optimizeDeps: {
    // Never pre-bundle undocs's own source as a third-party dep. When installed,
    // `src/**` (reached via `@app`/`@server`/`undocs/src/*`) lives inside
    // `node_modules`, so Vite's scanner would pre-bundle `@app/router` etc. —
    // coexisting with the same modules served as source and creating duplicate
    // instances (e.g. two `Symbol(undocs-route)`, breaking `useRoute()` inject).
    // `exclude` matches by prefix, so these three cover all specifiers.
    exclude: ["@app", "@server", "undocs"],
  },

  plugins: [
    // `virtual:undocs/app-config` — the client app-config vfs. Generated once
    // from the docs project config (c12) via `generateAppConfig(docsDir)`; the
    // client `useAppConfig()` composable imports this and merges it over the
    // undocs theme config (`src/app/app.config.ts`). Replaces the old runtime
    // `/api/docs/config` HTTP fetch.
    undocsAppConfig(docsDir),

    // `virtual:undocs/user-{components,pages,layouts}` — the user THEME layer
    // (`<docsDir>/.docs/{components,pages,layouts}`), loaded into the app via the
    // markdown renderer, the router, and `AppLayout`. `enforce: "pre"` so its
    // Tailwind `@source ".docs"` lands before `tailwindcss()` parses the CSS.
    undocsUserTheme(docsDir),

    // `virtual:undocs/builtin-icons` — undocs' own icons extracted from local
    // `@iconify-json/*` packages, seeded into Iconify storage on both sides so
    // they render with no Iconify-API call (see `builtin-icons.ts` / `ssr/icons`).
    undocsBuiltinIcons(),

    // DEV-ONLY: exclude the docs dir from Tailwind's scanner (see the plugin def
    // below). Must run BEFORE `tailwindcss()` — hence `enforce: "pre"` + array
    // order — so the injected `@source not` is present when Tailwind parses the
    // CSS. Fixes the docs-edit full-reload that raced the soft content refresh.
    excludeDocsFromTailwindDev(docsDir),

    // Tailwind v4 pipeline. Processes
    // `@import "tailwindcss"` + `@theme`/`@source` in `src/app/css.css`.
    tailwindcss(),

    // Workaround https://github.com/vitejs/vite-plugin-vue/issues/677 — the
    // `?assets` virtual modules used by Nitro's SSR asset collection must skip
    // the vue transform.
    patchVueExclude(vue(), /\?assets/),

    // Nitro + Vite integration. Both the `client` and `ssr` environments below
    // are its inputs: the client bundle plus the shell renderer (`entry-server.ts`)
    // that Nitro auto-wires as the renderer (no `renderer.template` needed).
    nitro(),

    // DEV-ONLY: applies the `import.meta.server`/`client` flags to dev-served
    // modules. Prod gets this via `environments.{client,ssr}.define` below, but
    // Vite's dev server doesn't apply `define` to dev-served browser modules —
    // `import.meta.client` survives as `undefined` there, silently killing
    // `if (import.meta.client)` branches. `apply: "serve"` scopes it to dev.
    metaEnvFlagsDev(),

    // DEV-ONLY: re-imports Nitro's cached SSR entry after an app-source edit.
    // Without it the entry's static graph goes stale while request-time
    // `import()`s (the router's page components) re-evaluate fresh — two copies
    // of `router.ts`, so the page's `useRoute()` injection misses.
    ssrEntryReloadDev(),
  ],

  environments: {
    client: {
      // `import.meta.server=false` / `client=true` for the browser bundle.
      define: { "import.meta.server": "false", "import.meta.client": "true" },
      // The `app/` sources import composables/components directly via the
      // `@app` alias above — no `#imports` / `#app` virtuals in the client or
      // `ssr` shell-asset graph.
      build: {
        // Emit hashed client assets under `/_undocs` instead of Vite's default
        // `/assets`, so they don't collide with docs `public/assets/*` files.
        //
        // A PRESET MAY OVERRIDE THIS: Vercel's `immutableStaticFiles`
        // (`src/server/vercel.ts`) repoints the bundle at
        // `_vercel/immutable/<salt>/undocs`, the only path that host serves from
        // its cross-deployment store. Nitro supplies the dir it chose as
        // `entry`/`chunk`/`assetFileNames` — but only while all three are UNSET,
        // so leave them that way. A pattern of our own has to spell the prefix
        // itself, string or callback alike (nitro only widens `[hash]` inside a
        // string it finds, never the dir), and the one that gets spelled is the
        // one nitro could not replace — which leaves the entry chunk in the
        // immutable dir and every other chunk outside it, silently.
        assetsDir: "_undocs",
        rolldownOptions: {
          // Client build entry. Previously `index.html`; now the bare `main.ts`
          // module, which the shell renderer (`src/app/entry-server.ts`) imports
          // as `main.ts?assets=client` to inject the hashed bundle into <head>.
          input: r("./src/app/main.ts"),
        },
      },
    },

    // SSR render environment. Its entry (`entry-server.ts`) server-renders
    // `app.vue` with `renderToString` and inlines a hydration payload; `main.ts`
    // then hydrates. Nitro auto-wires this environment's `fetch` as the renderer
    // when `nitro.config.ts` sets no `renderer.template`/`renderer.handler`.
    ssr: {
      // `import.meta.server=true` / `client=false` for the SSR render env.
      define: { "import.meta.server": "true", "import.meta.client": "false" },
      build: {
        // Assets are named EXACTLY as in the client build above. Both envs see
        // the same asset imports (the docs project's `icon.svg`, reached through
        // `virtual:undocs/app-config`) and each resolves the import to a URL of
        // its own making — so a different `assetsDir` here renders `<img src>`
        // and the favicon at one URL on the server and another on hydrate. Same
        // config + Vite's content hash = one URL, and the two envs emit the same
        // file rather than two copies. Leaving the name patterns to Vite is part
        // of that: nitro applies a preset's assets dir to BOTH envs, so they stay
        // in step through an override too.
        assetsDir: "_undocs",
        rolldownOptions: {
          input: r("./src/app/entry-server.ts"),
        },
      },
    },
  },
}));
