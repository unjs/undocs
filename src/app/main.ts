/**
 * Client entry / bootstrap (SSR hydration).
 *
 * The server (`entry-server.ts`) renders `app.vue` into `#root` and inlines a
 * hydration payload. Here we seed the async-data + state stores from that payload
 * BEFORE creating the app, wire the shared infrastructure — @unhead/vue, our
 * color-mode + Iconify icon collection, the page router (`./router`), the
 * app composables — then hydrate the server-rendered markup with
 * `createSSRApp(...).mount("#root")`.
 *
 * Components are NOT registered globally: every component is imported explicitly
 * where it is used (`app.vue`, pages, layouts, other components). The markdown
 * renderer (`content/MarkdownRenderer.ts`) keeps its own explicit tag→component
 * registry.
 */
import "./css.css";

import {
  createSSRApp,
  defineComponent,
  h,
  shallowRef,
  Suspense,
  watch,
  onErrorCaptured,
} from "vue";

import { createHead } from "@unhead/vue/client";

// The app root + error page. Both have async `<script setup>` (top-level
// `await useAsyncData("navigation", ...)`), so each is mounted inside a Suspense.
import AppComponent from "@app/app.vue";
import ErrorPage from "@app/error.vue";

import { createAppRouter, useRoute } from "./router";
import type { AppError } from "@app/composables/createError";
import { useAppConfig } from "@app/composables/useAppConfig";
import { useColorMode } from "@app/composables/useColorMode";
import { hydrateAsyncData } from "@app/composables/useAsyncData";
import { hydrateState } from "@app/composables/useState";
import { seedBuiltinIcons, seedClientIcons } from "@app/ssr/icons";
import { readPayload } from "@app/ssr/payload";
import { primaryCss, STYLE_ID } from "@app/theme-primary";
import { registerUserComponents } from "@app/user-theme";

// ---------------------------------------------------------------------------
// Runtime primary color fallback: the server already inlines this <style> for
// SSR (`entry-server.ts`). Only inject here if it's missing (e.g. a pure
// client nav), keyed by `STYLE_ID` to avoid duplicating the server's tag.
// ---------------------------------------------------------------------------
function applyRuntimePrimary(themeColor: unknown): void {
  if (document.getElementById(STYLE_ID)) return;
  const css = primaryCss(themeColor);
  if (!css) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}

function bootstrap(): void {
  // -------------------------------------------------------------------------
  // 0. Seed the async-data + state stores from the server payload, so awaited
  //    `useAsyncData` calls resolve with the server's data (no refetch) and the
  //    markup hydrates without a mismatch. Must run before the app is created.
  // -------------------------------------------------------------------------
  const payload = readPayload();
  hydrateAsyncData(payload.data);
  hydrateState(payload.state);
  // Seed the bundled built-in icons (shipped in the client bundle, no network),
  // then the server-resolved payload icons (the non-built-in ones the page used).
  // Both go into Iconify storage BEFORE the app is created so icons render
  // synchronously on the first client render — matching the server's SVGs.
  seedBuiltinIcons();
  seedClientIcons(payload.icons);

  // -------------------------------------------------------------------------
  // 1. Own infrastructure: apply the persisted color mode (toggles `.dark`
  //    before hydration).
  // -------------------------------------------------------------------------
  useColorMode();

  // 2. Ensure the primary token is set (no-op if the server already emitted it).
  applyRuntimePrimary(useAppConfig().ui?.colors?.primary);

  // -------------------------------------------------------------------------
  // 3. Real router (page routes + layout meta). Components reach it via
  //    our own `useRouter()` / `useRoute()` (`./router`).
  // -------------------------------------------------------------------------
  const router = createAppRouter();

  // -------------------------------------------------------------------------
  // 4. Root: error boundary + Suspense. Fatal `createError` throws bubble to
  //    `onErrorCaptured`, swapping in the error page (cleared on next nav).
  //    Both pages are async, each in its own `<Suspense>`; success path is
  //    `Suspense > app.vue`, matching the server's output for hydration.
  // -------------------------------------------------------------------------
  const RootApp = defineComponent({
    name: "RootApp",
    setup() {
      // Seed the boundary when the server rendered the error page, so the client's
      // FIRST render is the error page too — matching the server DOM. Otherwise it
      // would hydrate `app.vue`, re-run the failing page, throw, and swap mid-
      // hydration: a mismatch that crashes Vue's unmount (`nextSibling` of null).
      // Cleared by the route watcher below on the next navigation.
      const err = shallowRef<AppError | null>(payload.error ?? null);

      onErrorCaptured((e: any) => {
        if (e?.fatal || e?.statusCode) {
          err.value = e;
          return false; // handled — stop propagation
        }
        // Non-fatal errors propagate normally (surfaced in console).
        return true;
      });

      const route = useRoute();
      watch(
        () => route.fullPath,
        () => {
          err.value = null;
        },
      );

      return () =>
        err.value
          ? h(Suspense, null, { default: () => h(ErrorPage, { error: err.value }) })
          : h(Suspense, null, { default: () => h(AppComponent) });
    },
  });

  const app = createSSRApp(RootApp);

  // User `.docs/components/**` registered globally (auto-import stand-in) — must
  // run before mount so user pages/layouts resolve them, matching the server.
  registerUserComponents(app);

  // unhead — created here so the app owns the head instance.
  const head = createHead();
  app.use(head);

  // Single router instance, installed before mount so `useRoute()` in RootApp
  // and every page resolves.
  app.use(router);

  // Wait for the initial route to resolve, then hydrate the server-rendered DOM.
  router.isReady().then(() => {
    app.mount("#root");
    // Remove the dev-only loading fallback (see `entry-server.ts`) now that the
    // app is hydrated and `import "./css.css"` has run — styles are ready. Dropping
    // the `<style>` also clears its `#root { visibility: hidden }` rule, revealing
    // the styled app. Guarded by the Vite static `DEV` constant, so it tree-shakes
    // from the prod bundle.
    if (import.meta.env.DEV) {
      document.getElementById("__undocs_loading")?.remove();
      document.getElementById("__undocs_loading_style")?.remove();
    }
  });

  // Dev-only content live-reload. `import.meta.env.DEV` is a Vite static
  // constant (true in dev, replaced with `false` at build time), so this whole
  // branch — and the dynamically-imported `./dev-reload` chunk — is tree-shaken
  // out of the production client bundle.
  if (import.meta.env.DEV) {
    import("./dev-reload").then((m) => m.connectDevReload());

    // Dev and prod share an origin (localhost:3000), so a SW installed by an
    // earlier `pnpm build && pnpm start` / `vite preview` would keep controlling
    // the dev server and fight HMR. Tear down any such leftover in dev.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
      caches?.keys?.().then((keys) => {
        for (const key of keys) if (key.startsWith("undocs-offline")) caches.delete(key);
      });
    }
  }

  // Register the offline service worker (`public/sw.js`) in production only — a
  // SW in dev fights Vite's HMR (and the dev block above actively unregisters
  // it). It network-first caches the shell + content API so previously-visited
  // docs stay readable offline, and messages the client (see
  // `composables/useOffline.ts` → `StatusBanner`) when it falls back to cache.
  if (!import.meta.env.DEV && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

bootstrap();
