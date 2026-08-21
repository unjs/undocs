/**
 * SSR renderer entry (the `ssr` Vite environment).
 *
 * Nitro auto-wires this default-exported h3 handler as its renderer for every
 * non-API, non-asset request (no `renderer.template`/`renderer.handler` set in
 * `nitro.config.ts`). It's an `defineHandler` (not a bare `{ fetch }`) so we hold
 * the h3 `event` and can flush the client-bundle preloads as HTTP 103 Early Hints
 * before the render. This server-renders `app.vue` with `renderToString`, streams
 * the head via unhead, and inlines a hydration payload so the client (`main.ts`)
 * hydrates instead of building from scratch.
 *
 * Per request we:
 *   1. build a request-scoped `$fetch` (Nitro's internal `$fetch` when present —
 *      no network — else a same-origin loopback) and an empty per-request store
 *      (`ssr/server-context.ts`), so concurrent renders never share state;
 *   2. render `Suspense > app.vue` under a memory-history router at the request
 *      URL, inside the AsyncLocalStorage context so `useAsyncData`/`useState` and
 *      the content `$fetch` resolve against this request's store;
 *   3. serialize the resolved async-data + state into `window.__UNDOCS__`;
 *   4. inject the unhead-collected tags (title/SEO/OG + the client bundle assets)
 *      into the shell and return the HTML (with the page's status code).
 *
 * A page that throws a fatal `createError` (e.g. 404) rejects `renderToString`;
 * we catch it and re-render `error.vue` with the corresponding status.
 */
import { createSSRApp, h, Suspense } from "vue";
import { renderToString } from "vue/server-renderer";
import { createHead, transformHtmlTemplate } from "@unhead/vue/server";
import { $fetch as ofetch, type $Fetch } from "ofetch";
import { getIcon, iconLoaded, loadIcon } from "@iconify/vue";
import { defineHandler, writeEarlyHints } from "nitro/h3";

// `?assets=client` is Nitro's fullstack virtual module: the client entry manifest
// `{ entry, js: [{ href }], css: [{ href }] }` (hashed in prod, dev URLs in dev).
import clientAssets from "./main.ts?assets=client";

// The client bundle as HTTP `Link` values for a 103 Early Hints response — the
// same modulepreload/stylesheet assets injected into `<head>` (see `renderRoot`),
// known statically, so it's built once here rather than per request. Stylesheets
// go out as `preload; as=style` (the fetch-triggering early-hint rel; the doc's
// later `rel=stylesheet` matches the warmed cache entry).
const clientAssetHints = {
  link: [
    ...clientAssets.css.map(({ href }) => `<${href}>; rel=preload; as=style`),
    `<${clientAssets.entry}>; rel=modulepreload`,
    ...clientAssets.js.map(({ href }) => `<${href}>; rel=modulepreload`),
  ],
};

import AppComponent from "@app/app.vue";
import ErrorPage from "@app/error.vue";
import { createAppRouter, createMemoryHistory } from "./router.ts";
import {
  createServerContext,
  runWithServerContext,
  type UndocsServerContext,
} from "@app/ssr/server-context.ts";
import { PAYLOAD_GLOBAL, serializePayload, type UndocsPayload } from "@app/ssr/payload.ts";
import { builtinIconNames, seedBuiltinIcons } from "@app/ssr/icons.ts";
import { brandCss, BRAND_STYLE_ID } from "@app/theme-brand.ts";

// The compiled inline `<head>` programs, imported as text. Sources live in
// `src/app/inline/*.ts`; `scripts/build-inline.mjs` compiles them with rolldown
// to the checked-in `.js` beside each one. See `src/app/inline/README.md`.
import embedThemeCode from "@app/inline/embed-theme.js?raw";
import colorModeCode from "@app/inline/color-mode.js?raw";
import themeColorCode from "@app/inline/theme-color.js?raw";
import { isAssetPath } from "@app/assets-base.ts";
import { DEFAULT_COLOR_MODE } from "@app/color-mode.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { registerUserComponents } from "@app/user-theme.ts";

// Seed the bundled built-in icons into (process-global) Iconify storage once, at
// module load — so the very first render emits their real SVGs with no Iconify-API
// call. They're excluded from the page payload below (the client bundles them).
seedBuiltinIcons();

/** Render a root (app or error page) at `routePath` within the request context. */
async function renderRoot(
  routePath: string,
  ctx: UndocsServerContext,
  rootRender: () => unknown,
): Promise<{ appHtml: string; head: ReturnType<typeof createHead>; error: any }> {
  const head = createHead();
  head.push({
    link: [
      // `rel` must stay a literal so unhead v3's discriminated `Link` union
      // resolves to `StylesheetLink`/`ModulepreloadLink` (a widened `string`
      // matches no member).
      ...clientAssets.css.map((attrs) => ({ rel: "stylesheet" as const, ...attrs })),
      ...clientAssets.js.map((attrs) => ({ rel: "modulepreload" as const, ...attrs })),
    ],
    script: [{ type: "module", src: clientAssets.entry }],
  });

  // Inline the brand-color token so the first paint is themed (no flash).
  const brand = brandCss(useAppConfig().ui?.colors?.primary);
  if (brand) head.push({ style: [{ id: BRAND_STYLE_ID, innerHTML: brand }] });

  const router = createAppRouter(createMemoryHistory());
  const app = createSSRApp({ setup: () => rootRender });

  // User `.docs/components/**` registered globally (auto-import stand-in), so the
  // SSR render resolves them exactly as the client will on hydration.
  registerUserComponents(app);

  // A fatal `createError` (e.g. 404) is thrown from a page's async setup, which
  // lives inside `AppPage`'s nested `<Suspense>`. Vue's SSR catches errors at that
  // boundary rather than rejecting `renderToString`, so we capture them here to
  // drive the error-page re-render. Non-fatal render errors are logged and the
  // (partial) render is kept — graceful degradation, matching CSR behavior.
  let error: any = null;
  app.config.errorHandler = (err: any) => {
    if (err?.statusCode || err?.fatal) error = err;
    else console.error("[undocs:ssr] render error:", err);
  };

  app.use(router);
  app.use(head);

  await router.push(routePath);
  await router.isReady();

  // Run the render inside the AsyncLocalStorage context so the composables and
  // the content `$fetch` resolve against THIS request's per-request store.
  const appHtml = await runWithServerContext(ctx, () => renderToString(app));
  return { appHtml, head, error };
}

/** Collect the resolved (successful) async-data entries for the payload. */
function collectAsyncData(ctx: UndocsServerContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of ctx.asyncData) {
    if (entry.refs.status.value === "success") out[key] = entry.refs.data.value;
  }
  return out;
}

/**
 * Load the given icons into Iconify's (process-global) storage so the next
 * render can emit real SVGs. `loadIcon` is the promise-based single-icon loader
 * (`loadIcons` is callback/abort-based); `allSettled` tolerates missing icons,
 * and a timeout guards against a slow/unreachable Iconify API stalling the SSR.
 */
async function preloadIcons(names: string[], timeoutMs = 1500): Promise<void> {
  if (!names.length) return;
  await Promise.race([
    Promise.allSettled(names.map((n) => loadIcon(n))),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Serialize the resolved data for this page's requested icons, for the payload. */
function collectIcons(ctx: UndocsServerContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of ctx.icons) {
    // Built-in icons ship in the client bundle (seeded directly) — no need to
    // round-trip them through the payload.
    if (builtinIconNames.has(name)) continue;
    if (!iconLoaded(name)) continue;
    const data = getIcon(name);
    if (data) out[name] = data;
  }
  return out;
}

// Dev-only loading fallback: in dev Vite injects CSS via the JS module, so
// between the HTML response and `main.ts` running, SSR'd `#root` would flash
// unstyled. The `<style>` must live in `<head>` (hides `#root` before the body
// paints — an overlay placed after `#root` would lose the paint race). `main.ts`
// removes both nodes right after hydration, once CSS has loaded.
// `import.meta.dev` is compile-time, so this DCEs to `""` in production.
const devLoadingStyle = import.meta.dev
  ? /* html */ `<style id="__undocs_loading_style">
      #root { visibility: hidden }
      @keyframes __undocs_spin { to { transform: rotate(360deg) } }
      #__undocs_loading {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        background: #fff; color: #000;
      }
      #__undocs_loading .s {
        width: 28px; height: 28px; border-radius: 50%;
        border: 3px solid currentColor; border-top-color: transparent;
        opacity: .35; animation: __undocs_spin .7s linear infinite;
      }
      @media (prefers-color-scheme: dark) {
        #__undocs_loading { background: #0a0a0a; color: #fff }
      }
    </style>`
  : "";
const devLoadingOverlay = import.meta.dev
  ? /* html */ `<div id="__undocs_loading" aria-hidden="true"><span class="s"></span></div>`
  : "";

// The visitor's color mode, applied before the first paint — the shell below
// ships the default mode because the server can't know the preference. See
// `inline/color-mode.ts`.
const colorModeScript = /* html */ `<script>${colorModeCode}</script>`;

// The visitor's own accent, applied before the first paint — the `<style>` this
// file inlines below carries the DOCS PROJECT's `themeColor`, which is the only
// one the server knows. See `inline/theme-color.ts`.
//
// MUST come before `embedThemeScript`: the two write `--brand` at the same
// specificity, so the later tag wins, and an embedder's pinned accent has to be
// the one that does.
const themeColorScript = /* html */ `<script>${themeColorCode}</script>`;

// Per-embed theme override read from the URL fragment. Blocking and inline
// because the fragment never reaches the server: SSR cannot pre-apply it, and
// deferring to `main.ts` would flash the default theme first. See
// `embed-theme.ts` for the payload format and the safety rules.
//
// MUST come after `colorModeScript`: its `m` key pins the mode for an embedder
// and has to win over the visitor's stored preference.
const embedThemeScript = /* html */ `<script>${embedThemeCode}</script>`;

function htmlTemplate(appHtml: string, payload: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en" dir="ltr" class="${DEFAULT_COLOR_MODE}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${colorModeScript}
    ${themeColorScript}
    ${embedThemeScript}
    ${devLoadingStyle}
  </head>
  <body>
    ${devLoadingOverlay}
    <div id="root">${appHtml}</div>
    <script>window.${PAYLOAD_GLOBAL}=${payload}</script>
  </body>
</html>`;
}

const handler = defineHandler(async (event): Promise<Response> => {
  // A missing build asset must NOT render the SPA error page. Browsers enforce
  // the MIME type of module scripts, so answering `main-<hash>.js` with
  // `text/html` fails as "Expected a JavaScript-or-Wasm module script" rather
  // than a plain 404 — and it wastes a full SSR render on a static 404. This
  // happens whenever HTML outlives the build it names (a tab open across a
  // deploy, or a stale cached document).
  //
  // `no-store` matters as much as the body: hosts stamp this path `immutable`
  // by pattern, before knowing the file exists, so a cacheable 404 here gets
  // stored for a year and never revalidated. Vercel gets the same treatment at
  // the routing layer (`src/server/vercel.ts`); this covers every other preset.
  if (isAssetPath(event.url.pathname)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8", "cache-control": "no-store" },
    });
  }

  // Flush the client-bundle preloads as HTTP 103 Early Hints, ahead of the
  // buffered render, so the browser downloads the JS/CSS during it rather than
  // waiting for the first HTML byte. `writeEarlyHints` self-no-ops on runtimes
  // without a Node `res` (serverless/edge, e.g. Vercel — which don't forward 103s
  // anyway).
  writeEarlyHints(event, clientAssetHints);

  // `event.url` is h3's already-parsed `URL` for the request.
  const { url } = event;
  const routePath = url.pathname + url.search;

  // Prefer Nitro's internal `$fetch` (resolves `/api/docs/*` in-process, no
  // network) when present; otherwise loopback to the request origin.
  const internal = (globalThis as any).$fetch as $Fetch | undefined;
  const reqFetch: $Fetch =
    typeof internal === "function" ? internal : ofetch.create({ baseURL: url.origin });

  // Nitro's prerenderer tags each request with an `x-nitro-prerender` header (the
  // route being baked) — our per-request "is this a prerender pass" signal.
  // `import.meta.prerender` can't be used here: it's baked to `false` at build
  // time (one build serves both live SSR and prerendering).
  const isPrerender = event.req.headers.has("x-nitro-prerender");

  let ctx = createServerContext(reqFetch, isPrerender);
  let status = 200;
  let appHtml = "";
  let head = createHead();
  let error: any;

  const appRoot = () => h(Suspense, null, { default: () => h(AppComponent) });

  try {
    ({ appHtml, head, error } = await renderRoot(routePath, ctx, appRoot));
    // Second pass: the first render collected this page's icons into `ctx.icons`
    // but Iconify couldn't resolve their async API loads in time, so they came
    // out as placeholders. Preload the ones still missing (icon storage is
    // process-global, so a warm instance usually has them already) and re-render
    // so they emit real SVGs. `collectIcons` then ships the data to the client.
    if (!error && ctx.icons.size) {
      const missing = [...ctx.icons].filter((n) => !iconLoaded(n));
      if (missing.length) {
        await preloadIcons(missing);
        if (missing.some((n) => iconLoaded(n))) {
          ({ appHtml, head, error } = await renderRoot(routePath, ctx, appRoot));
        }
      }
    }
  } catch (thrown: any) {
    // Some errors reject `renderToString` outright (rather than being caught at a
    // Suspense boundary and surfaced via `errorHandler`) — handle both paths.
    error = thrown;
  }

  let errorProp: UndocsPayload["error"];
  if (error?.statusCode || error?.fatal) {
    status = Number(error.statusCode) || 500;
    // Fresh context so the failed page's partial fetches don't leak into the
    // payload; re-render the error page with the same request `$fetch`.
    ctx = createServerContext(reqFetch);
    errorProp = {
      statusCode: status,
      statusMessage: error.statusMessage,
      message: error.message,
    };
    const errorRoot = () =>
      h(Suspense, null, { default: () => h(ErrorPage, { error: errorProp }) });
    ({ appHtml, head } = await renderRoot(routePath, ctx, errorRoot));
  }

  const payload: UndocsPayload = {
    data: collectAsyncData(ctx),
    state: Object.fromEntries([...ctx.state].map(([key, ref]) => [key, ref.value])),
    icons: collectIcons(ctx),
    // When we rendered the error page, tell the client so its first render is the
    // error page too — otherwise it hydrates `app.vue`, re-throws on the missing
    // page, and swaps mid-hydration (a mismatch that crashes Vue's unmount).
    ...(errorProp ? { error: errorProp } : {}),
  };

  const html = await transformHtmlTemplate(head, htmlTemplate(appHtml, serializePayload(payload)));

  const headers: Record<string, string> = { "content-type": "text/html;charset=utf-8" };

  // Hint Nitro's prerenderer to also bake this page's content-API responses:
  // Nitro reads `x-nitro-prerender` as a comma-separated list of URI-encoded
  // routes and queues each (`src/prerender/utils.ts` → `extractLinks`). Only
  // query-less routes qualify (`docFetch` filters to those), and they must stay
  // out of the prerender `ignore` list (`nitro.config.ts`) or get filtered back out.
  if (isPrerender && status === 200 && ctx.prerenderRoutes?.size) {
    headers["x-nitro-prerender"] = [...ctx.prerenderRoutes]
      .map((route) => encodeURIComponent(route))
      .join(",");
  }

  return new Response(html, { status, headers });
});

export default handler;
