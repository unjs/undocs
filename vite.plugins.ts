import { resolve, basename } from "node:path";
import { glob, readFile } from "node:fs/promises";
import type { Plugin, ViteDevServer } from "vite";
import { generateAppConfig } from "./src/server/app-config";
import { BUILTIN_ICONS } from "./src/app/builtin-icons";

// `virtual:undocs/builtin-icons` provider — the local, no-network icon set.
//
// Extracts the fixed icon set undocs' UI uses (`src/app/builtin-icons.ts`) from
// locally-installed `@iconify-json/<collection>` packages at build time into a
// flat `Record<"collection:name", IconifyIcon>`, seeded into Iconify storage
// before render/mount so built-ins render synchronously offline (others still
// fall back to the Iconify API). `@iconify/utils`/`@iconify-json/*` are runtime
// deps, not dev — `undocs build` runs in the CONSUMER's install, not ours.
export function undocsBuiltinIcons(): Plugin {
  const VIRTUAL_ID = "virtual:undocs/builtin-icons";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;

  return {
    name: "undocs:builtin-icons",

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return;
      // `getIconData` resolves aliases + inherits collection width/height, so each
      // entry is a self-contained `IconifyIcon` ready for Iconify's `addIcon`.
      const { getIconData } = await import("@iconify/utils");
      const out: Record<string, unknown> = {};
      for (const [collection, names] of Object.entries(BUILTIN_ICONS)) {
        const mod = await import(`@iconify-json/${collection}/icons.json`, {
          with: { type: "json" },
        });
        const set = (mod.default ?? mod) as Parameters<typeof getIconData>[0];
        for (const name of names) {
          const data = getIconData(set, name);
          if (data) out[`${collection}:${name}`] = data;
          else this.warn(`[undocs] built-in icon not found: ${collection}:${name}`);
        }
      }
      return `export default ${JSON.stringify(out)};`;
    },
  };
}

// `virtual:undocs/app-config` provider — serves config generated from the docs
// project (c12), including landing markdown/heroCode transforms. Generated once
// per build (unlike the old HTTP route, which re-read every request), so dev
// watches `.config` and explicitly invalidates + full-reloads on change.
export function undocsAppConfig(docsDir: string): Plugin {
  const VIRTUAL_ID = "virtual:undocs/app-config";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;
  const configDir = resolve(docsDir, ".config");

  return {
    name: "undocs:app-config",

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return;
      const config = await generateAppConfig(docsDir);
      return `export default ${JSON.stringify(config)};`;
    },

    configureServer(server: ViteDevServer) {
      // The docs dir usually lives outside the Vite root, so add its `.config`
      // to the watcher explicitly.
      server.watcher.add(configDir);
      const onChange = (file: string) => {
        if (!file.startsWith(configDir)) return;
        for (const env of Object.values(server.environments)) {
          const mod = env.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) env.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", onChange);
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}

// `virtual:undocs/user-{components,pages,layouts}` — the user THEME layer.
//
// A docs project may ship a `.docs/` dir (skipped by `bundle-docs.ts`, read by
// `_og` for `public/`) to extend the app with its own Vue:
//   - `.docs/components/**/*.vue` — Markdown-usable (kebab tag) + registered
//     globally for user pages/layouts.
//   - `.docs/pages/**/*.vue`      — file routes layered OVER the built-ins
//     (e.g. a user `index.vue` overrides the landing page).
//   - `.docs/layouts/**/*.vue`    — named layouts via a page's `meta.layout`.
//
// These live outside the Vite root, so instead of `import.meta.glob` this
// plugin emits ES modules that statically import the `.vue` files by absolute
// path (keeping `@vitejs/plugin-vue` transforms) into a name→component map /
// route table — generated once per build; dev watches `.docs` and regenerates
// + full-reloads only on ADD/UNLINK (plain edits hot-update normally).
//
// `enforce: "pre"` so the Tailwind `@source` appended to `css.css` lands before
// `tailwindcss()` parses it.
export function undocsUserTheme(docsDir: string): Plugin {
  const themeDir = resolve(docsDir, ".docs");
  const dirs = {
    components: resolve(themeDir, "components"),
    pages: resolve(themeDir, "pages"),
    layouts: resolve(themeDir, "layouts"),
  };

  const IDS = {
    "virtual:undocs/user-components": "\0virtual:undocs/user-components",
    "virtual:undocs/user-pages": "\0virtual:undocs/user-pages",
    "virtual:undocs/user-layouts": "\0virtual:undocs/user-layouts",
  } as const;
  const RESOLVED = new Set<string>(Object.values(IDS));

  // Sorted POSIX-relative `.vue` paths under `dir` (empty if absent).
  const listVue = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    try {
      for await (const f of glob("**/*.vue", { cwd: dir })) {
        out.push(f.split("\\").join("/"));
      }
    } catch {
      // Dir doesn't exist — no user files of this kind.
    }
    return out.sort();
  };

  // `AppHero.vue` / `HeroBackground.client.vue` → `AppHero` / `HeroBackground`.
  const compName = (rel: string) => basename(rel).replace(/\.(client|server)?\.?vue$/, "");

  const genComponents = async (): Promise<string> => {
    const files = await listVue(dirs.components);
    const imports = files.map(
      (rel, i) => `import __c${i} from ${JSON.stringify(resolve(dirs.components, rel))};`,
    );
    const entries = files.map((rel, i) => `  ${JSON.stringify(compName(rel))}: __c${i},`);
    return `${imports.join("\n")}\nexport const components = {\n${entries.join("\n")}\n};\nexport default components;\n`;
  };

  const genLayouts = async (): Promise<string> => {
    const files = await listVue(dirs.layouts);
    const imports = files.map(
      (rel, i) => `import __l${i} from ${JSON.stringify(resolve(dirs.layouts, rel))};`,
    );
    // key = lower-cased basename, matching a page's `meta.layout` string.
    const entries = files.map(
      (rel, i) => `  ${JSON.stringify(compName(rel).toLowerCase())}: __l${i},`,
    );
    return `${imports.join("\n")}\nexport const layouts = {\n${entries.join("\n")}\n};\nexport default layouts;\n`;
  };

  const genPages = async (): Promise<string> => {
    const files = await listVue(dirs.pages);
    const routes = await Promise.all(
      files.map(async (rel) => {
        const abs = resolve(dirs.pages, rel);
        const { match, catchAll, segCount } = routeFromRel(rel);
        // Best-effort layout from `definePageMeta({ layout: "..." })`. The macro
        // never runs here (it's Nuxt); this static read is the stand-in.
        const src = await readFile(abs, "utf8").catch(() => "");
        const layout = src.match(
          /definePageMeta\s*\(\s*\{[\s\S]*?\blayout\s*:\s*["'`]([^"'`]+)["'`]/,
        )?.[1];
        const meta = layout ? { layout } : {};
        return { abs, match, catchAll, segCount, meta };
      }),
    );
    // Exact routes before catch-alls; within each, deeper paths first, so a
    // `/examples` index wins over an `/examples/**` catch-all.
    routes.sort((a, b) => Number(a.catchAll) - Number(b.catchAll) || b.segCount - a.segCount);
    const entries = routes.map(
      (r) =>
        `  { match: ${JSON.stringify(r.match)}, meta: ${JSON.stringify(r.meta)}, component: () => import(${JSON.stringify(r.abs)}) },`,
    );
    return `export const pages = [\n${entries.join("\n")}\n];\nexport default pages;\n`;
  };

  return {
    name: "undocs:user-theme",
    enforce: "pre",

    resolveId(id) {
      if (id in IDS) return IDS[id as keyof typeof IDS];
      return undefined;
    },

    load(id) {
      if (!RESOLVED.has(id)) return;
      if (id === IDS["virtual:undocs/user-components"]) return genComponents();
      if (id === IDS["virtual:undocs/user-layouts"]) return genLayouts();
      if (id === IDS["virtual:undocs/user-pages"]) return genPages();
      return undefined;
    },

    // Scan `.docs/**` for Tailwind classes (before `tailwindcss()` parses,
    // via enforce: "pre"). Must be an explicit GLOB: the theme lives in a
    // typically git-ignored docs project, so Tailwind's auto source detection
    // (which skips git-ignored paths) would otherwise scan nothing; this also
    // re-includes what `excludeDocsFromTailwindDev`'s dev `@source not` blanks.
    transform(code, id) {
      if (!id.endsWith("/css.css")) return;
      const glob = `${themeDir}/**/*.{vue,js,jsx,ts,tsx}`;
      return { code: `${code}\n@source ${JSON.stringify(glob)};\n`, map: null };
    },

    configureServer(server: ViteDevServer) {
      server.watcher.add(themeDir);
      const onStructureChange = (file: string) => {
        if (!file.startsWith(themeDir) || !file.endsWith(".vue")) return;
        for (const env of Object.values(server.environments)) {
          for (const rid of RESOLVED) {
            const mod = env.moduleGraph.getModuleById(rid);
            if (mod) env.moduleGraph.invalidateModule(mod);
          }
        }
        server.ws.send({ type: "full-reload" });
      };
      // Only ADD/UNLINK change the generated set; plain edits hot-update through
      // the real `.vue` module and must NOT force a full reload.
      server.watcher.on("add", onStructureChange);
      server.watcher.on("unlink", onStructureChange);
    },
  };
}

// Map a `.docs/pages` relative path to a `RegExp` source the router compiles
// and tests against `route.path`:
//   index.vue              → ^/?$                 (landing route)
//   examples/index.vue     → ^/examples/?$
//   examples/[...slug].vue → ^/examples(?:/.*)?$  (catch-all)
//   [...slug].vue          → ^/.*$                (root catch-all)
//   foo/[id].vue           → ^/foo/[^/]+/?$       (dynamic segment)
// Params aren't extracted — pages read `route.path` directly instead.
function routeFromRel(rel: string): { match: string; catchAll: boolean; segCount: number } {
  const parts = rel.replace(/\.vue$/, "").split("/");
  if (parts.at(-1) === "index") parts.pop();

  const catchIdx = parts.findIndex((p) => /^\[\.\.\..+\]$/.test(p));
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (catchIdx !== -1) {
    const prefix = parts
      .slice(0, catchIdx)
      .map((p) => (/^\[.+\]$/.test(p) ? "[^/]+" : escape(p)))
      .join("/");
    return {
      match: prefix ? `^/${prefix}(?:/.*)?$` : "^/.*$",
      catchAll: true,
      segCount: catchIdx,
    };
  }

  if (parts.length === 0) return { match: "^/?$", catchAll: false, segCount: 0 };
  const body = parts.map((p) => (/^\[.+\]$/.test(p) ? "[^/]+" : escape(p))).join("/");
  return { match: `^/${body}/?$`, catchAll: false, segCount: parts.length };
}

// DEV-ONLY `import.meta.{server,client,dev,prerender}` replacement.
//
// Vite applies these `define`s at build time (both env-scoped `server`/`client`
// and top-level `dev`/`prerender`) and to the dev SSR transform, but NOT to
// dev-served browser (client-env) modules — there `import.meta.client` etc. are
// left `undefined` at runtime, silently killing positive branches. This plugin
// restores parity by doing the env-scoped token replacement itself in dev.
//
// `enforce: "post"` runs after Vue compiles SFCs to JS. Only touches our own
// sources (`/src/`) and uses word boundaries (so `import.meta.serverContext`/
// `.hot` aren't matched). Values: server envs get server=true/client=false (the
// client env the inverse), dev=true and prerender=false everywhere.
export function metaEnvFlagsDev(): Plugin {
  const TOKENS = /\bimport\.meta\.(server|client|dev|prerender)\b/;
  return {
    name: "undocs:meta-env-flags-dev",
    apply: "serve",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("/src/") || id.includes("/node_modules/")) return;
      if (!TOKENS.test(code)) return;
      const isServer = this.environment.name !== "client";
      const out = code
        .replace(/\bimport\.meta\.server\b/g, isServer ? "true" : "false")
        .replace(/\bimport\.meta\.client\b/g, isServer ? "false" : "true")
        .replace(/\bimport\.meta\.dev\b/g, "true")
        .replace(/\bimport\.meta\.prerender\b/g, "false");
      // `map: null` keeps Vite's own sourcemap for the module; the substitutions
      // are length-changing but dev-only, so precise mapping here isn't critical.
      return { code: out, map: null };
    },
  };
}

// DEV-ONLY: stop Tailwind from scanning the docs dir in dev.
//
// Tailwind's scanner full-reloads the browser on any watched file change. Docs
// Markdown gets watched both via the explicit `@source` in `css.css` and via v4's
// automatic source detection (repo `docs/` isn't git-ignored) — that reload fires
// ~100ms BEFORE the soft content live-reload (`/api/docs/_ws` + `dev-watch.ts`),
// so the page showed STALE content until a manual refresh.
//
// Appending `@source not "<docsDir>/**/*";` (a negated source beats both) stops
// Tailwind from watching docs edits, leaving the soft refresh to handle them.
// `apply: "serve"` scopes this to dev; `enforce: "pre"` + registering before
// `tailwindcss()` ensures we edit the CSS before it parses `@source` directives.
export function excludeDocsFromTailwindDev(docsDir: string): Plugin {
  return {
    name: "undocs:exclude-docs-from-tailwind-dev",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/css.css")) return;
      // Exclude only the docs CONTENT (markdown) — that Markdown watcher is the
      // reload-race source. Must NOT blank the `.docs` THEME dir: its `.vue`
      // files carry Tailwind classes the app needs, and `undocsUserTheme`
      // re-includes them with an explicit glob. A blanket `**/*` here swallowed
      // `.docs` too, leaving user-theme components unstyled in dev.
      return { code: `${code}\n@source not "${docsDir}/**/*.md";\n`, map: null };
    },
  };
}

// Workaround https://github.com/vitejs/vite-plugin-vue/issues/677
export function patchVueExclude(plugin: any, exclude: RegExp) {
  const original = plugin.transform.handler;
  plugin.transform.handler = function (this: any, ...args: any[]) {
    if (exclude.test(args[1])) return;
    return original.call(this, ...args);
  };
  return plugin;
}
