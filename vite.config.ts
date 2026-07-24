import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolve, dirname, basename, extname } from "node:path";
import { defineConfig, type Rolldown } from "vite";
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
} from "./vite.plugins";

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

      // Public subpath for the docs `.docs/` theme (and any external consumer):
      // `undocs/src/*` → this package's `src/*`, matching the `exports` map in
      // package.json. This alias makes Vite/rolldown resolve it deterministically
      // without relying on a `node_modules/undocs` symlink.
      "undocs/src": r("./src"),

      // Companion alias for the Nitro/server sources. Node-only engine code
      // lives here — keep client imports of `@server/*` limited to the
      // client-safe helpers (`utils.ts`, `types.ts`) per the client/server split.
      "@server": r("./src/server"),

      // `@vueuse/core` (used directly + transitively by reka-ui/motion-v) is pinned
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
        assetsDir: "_undocs",
        rollupOptions: {
          // Client build entry. Previously `index.html`; now the bare `main.ts`
          // module, which the shell renderer (`src/app/entry-server.ts`) imports
          // as `main.ts?assets=client` to inject the hashed bundle into <head>.
          input: r("./src/app/main.ts"),
          output: {
            // Readable names for split/shared chunks (see `clientChunkName`) and
            // kind-grouped subdirs for emitted assets (see `clientAssetName`).
            chunkFileNames: clientChunkName,
            assetFileNames: clientAssetName,
          },
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
        rollupOptions: {
          input: r("./src/app/entry-server.ts"),
        },
      },
    },
  },
}));

// Friendlier client chunk names, derived from the chunk's primary module.
// Rolldown otherwise names shared chunks `chunk-<hash>`, dep chunks keep the
// vendor's own build hash in their basename, and dynamic-route pages collide
// on an unreadable `_..._` (`pages/[...slug].vue` vs `pages/blog/[...slug]`).
// Instead:
//   - app source   → module path under `src/app`, route brackets stripped
//     (`pages/[...slug].vue` → `pages/slug`).
//   - vendored dep → `vendor/<pkg>/<leaf>-<hash>.js`, stripping the trailing
//     build-hash suffix and flattening anonymous `chunk-<hash>` splits.
//   - anything else → the chunk's name, module basename, or `chunk`.
// Trailing `[hash]` still guarantees uniqueness.
function clientChunkName(chunk: Rolldown.PreRenderedChunk): string {
  const id = chunk.facadeModuleId ?? chunk.moduleIds.at(-1);
  if (id?.startsWith(appDir)) {
    const rel = id
      .slice(appDir.length + 1)
      .replace(/\.\w+$/, "") // ext
      .replace(/\[\.\.\.([^\]]+)\]/g, "$1") // catch-all route `[...slug]` → `slug`
      .replace(/\[([^\]]+)\]/g, "$1"); // dynamic route `[id]` → `id`
    return `_undocs/${rel}-[hash].js`;
  }
  const dep = id?.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
  if (dep && id) {
    const pkg = dep[1].replace(/^@/, "");
    const leaf = basename(id)
      .replace(/\.\w+$/, "") // ext
      .replace(/(-[A-Z0-9]{8})+$/, "") // vendor build-hash suffix (`journeyDiagram-WII6DRMM`)
      .replace(/^chunk-.+$/, "chunk"); // vendor's own anonymous `chunk-<hash>` splits
    return `_undocs/vendor/${pkg}/${leaf || "chunk"}-[hash].js`;
  }
  if (chunk.name && !chunk.name.startsWith("chunk")) return `_undocs/${chunk.name}-[hash].js`;
  if (id) return `_undocs/${basename(id).replace(/\.\w+$/, "")}-[hash].js`;
  return "_undocs/chunk-[hash].js";
}

// Group emitted client assets by kind so `_undocs/` isn't a flat dump: fonts →
// `_undocs/fonts/`, stylesheets → `_undocs/css/`, everything else stays at the
// `_undocs/` root. Rolldown rewrites the (hashed) references, so nesting is safe.
function clientAssetName(asset: Rolldown.PreRenderedAsset): string {
  // Key off the emitted asset name (`main.css`), not `originalFileNames` — the
  // latter points at the importer (`main.ts`/`index.vue`) for bundled CSS.
  const src = asset.names?.[0] ?? asset.originalFileNames?.[0] ?? "";
  const ext = extname(src).toLowerCase();
  if (/^\.(?:woff2?|ttf|otf|eot)$/.test(ext)) return "_undocs/fonts/[name]-[hash][extname]";
  if (ext === ".css") return "_undocs/css/[name]-[hash][extname]";
  return "_undocs/[name]-[hash][extname]";
}
