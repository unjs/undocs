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

// Both async roots require Suspense.
import AppComponent from "@app/app.vue";
import ErrorPage from "@app/error.vue";

import { createAppRouter, useRoute } from "./router.ts";
import type { AppError } from "@app/composables/createError.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useColorMode } from "@app/composables/useColorMode.ts";
import { hydrateAsyncData } from "@app/composables/useAsyncData.ts";
import { hydrateState } from "@app/composables/useState.ts";
import { seedBuiltinIcons, seedClientIcons } from "@app/ssr/icons.ts";
import { readPayload } from "@app/ssr/payload.ts";
import { brandCss, BRAND_STYLE_ID } from "@app/theme-brand.ts";
import { registerUserComponents } from "@app/user-theme.ts";
import { installLinkCapture } from "@app/link-capture.ts";
import { installWebMCPPolyfill } from "./webmcp/polyfill.ts";
import { pluginHost } from "@app/plugins/host.ts";

// Preserve the server's first-paint brand style; inject only when absent.
function applyRuntimeBrand(themeColor: unknown): void {
  if (document.getElementById(BRAND_STYLE_ID)) return;
  const css = brandCss(themeColor);
  if (!css) return;
  const style = document.createElement("style");
  style.id = BRAND_STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}

// Reload once when a stale build's lazy chunk fails; the session stamp prevents loops.
const RELOAD_KEY = "undocs:stale-build-reload";
const RELOAD_WINDOW = 10_000;

function installStaleBuildReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
      if (Date.now() - last < RELOAD_WINDOW) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // Storage blocked (private mode / blocked cookies). Without it we can't
      // prove we haven't already reloaded, so don't risk the loop.
      return;
    }
    event.preventDefault();
    location.reload();
  });
}

function bootstrap(): void {
  installStaleBuildReload();

  // Seed payload and icons before app creation so hydration reuses SSR state and markup.
  const payload = readPayload();
  hydrateAsyncData(payload.data);
  hydrateState(payload.state);
  seedBuiltinIcons();
  seedClientIcons(payload.icons);

  useColorMode();
  applyRuntimeBrand(useAppConfig().ui?.colors?.primary);

  const router = createAppRouter();

  // Same-origin anchors the app never rendered — raw HTML in markdown, anything a
  // third-party script injects — navigate through the router instead of reloading
  // the site. Before mount is fine: the listener only fires on a real click.
  installLinkCapture(router);

  const RootApp = defineComponent({
    name: "RootApp",
    setup() {
      // Seed SSR errors before first render to avoid hydrating app.vue over an error page.
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

  // Register user components before mount to match SSR.
  registerUserComponents(app);

  const head = createHead();
  app.use(head);

  app.use(router);

  pluginHost.bootstrap(
    app,
    pluginHost.context(
      useAppConfig().docs,
      router,
      router.currentRoute.fullPath,
      router.currentRoute,
    ),
  );

  router.isReady().then(() => {
    app.mount("#root");
    // Reveal the dev app only after hydration and CSS loading.
    if (import.meta.env.DEV) {
      document.getElementById("__undocs_loading")?.remove();
      document.getElementById("__undocs_loading_style")?.remove();
    }
  });

  // The polyfill is in the main bundle; tools stay lazy until lookup unless native support registers now.
  if (useAppConfig().docs?.webmcp !== false) {
    const loadTools = () => import("./webmcp/index.ts").then((m) => m.setupWebMCP(router));
    if (document.modelContext) void loadTools();
    else installWebMCPPolyfill(loadTools);
  }

  // Static DEV replacement removes this lazy chunk from production.
  if (import.meta.env.DEV) {
    import("./dev-reload.ts").then((m) => m.connectDevReload());
  }

  // Remove legacy offline workers/caches everywhere; not registering leaves existing workers active.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
    caches?.keys?.().then((keys) => {
      for (const key of keys) if (key.startsWith("undocs-offline")) caches.delete(key);
    });
  }
}

bootstrap();
