import { defineUndocsPluginBundle } from "../../../../src/app/plugins/types.ts";
import { defineComponent, h } from "vue";
import type { UndocsAppConfig } from "../../../../src/server/app-config.ts";
import type { BuildOptions } from "../../../../src/server/content/builder.ts";

const EchoBadge = defineComponent({
  name: "EchoBadge",
  setup() {
    return () => h("span", { "data-testid": "echo-badge" }, "echo");
  },
});

export default defineUndocsPluginBundle({
  server: {
    name: "undocs-plugin-echo",
    appConfig(config: UndocsAppConfig) {
      config.docs._echoPlugin = true;
      return config;
    },
    content: {
      buildOptions(opts: BuildOptions) {
        return { ...opts, automd: opts.automd ?? "echo-marker" };
      },
      excludeFromOrder(path) {
        if (path === "/echo-hidden") return true;
        return undefined;
      },
      isBlogPost(path) {
        if (path.startsWith("/echo-blog/")) return true;
        return undefined;
      },
      acceptSurroundNeighbor(pagePath, neighborPath) {
        if (pagePath.startsWith("/echo/") && !neighborPath.startsWith("/echo/")) return false;
        return undefined;
      },
    },
    nitro(nitro) {
      nitro.runtimeConfig ??= {};
      (nitro.runtimeConfig as any).undocs ??= {};
      (nitro.runtimeConfig as any).undocs.echoPlugin = true;
    },
  },
  client: {
    name: "undocs-plugin-echo",
    install() {
      return { htmlLang: "echo" };
    },
    routes(routes) {
      return [
        {
          match: (p) => p === "/echo-plugin",
          component: () => Promise.resolve(EchoBadge),
          meta: {},
        },
        ...routes,
      ];
    },
    navigation(nav) {
      if (!nav?.length) return nav;
      const first = nav[0]!;
      return [{ ...first, title: `${first.title} [echo]` }, ...nav.slice(1)];
    },
    docsConfig(docs) {
      return { ...docs, name: `${docs.name ?? "Docs"} [echo]` };
    },
    filterPath(path) {
      return path !== "/echo-hidden";
    },
    components: { "echo-badge": EchoBadge },
    headerActions: EchoBadge,
    head() {
      return { meta: [{ name: "echo-plugin", content: "1" }] };
    },
  },
});
