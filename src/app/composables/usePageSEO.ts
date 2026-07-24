import { useRoute } from "@app/router";
import { useAppConfig } from "@app/composables/useAppConfig";
import { hintPrerenderRoute } from "@app/composables/useContent";
import { useHead, useSeoMeta } from "@unhead/vue";
export interface PageMeta {
  title: string;
  description: string;
}

export function usePageSEO(page: PageMeta) {
  const route = useRoute();
  const appConfig = useAppConfig();

  const description = page.description || appConfig.site.description || "";

  useSeoMeta({
    title: page.title,
    description,
  });

  // OG image/meta need an absolute base: live origin in client dev, else the
  // configured `site.url`. No base (e.g. local docs without `url`) → skip the
  // OG/canonical block; the useSeoMeta above still covers SSR/crawlers.
  //
  // Use `!import.meta.server`, not `import.meta.client`: the latter is
  // `undefined` in dev (Vite doesn't apply the client define there), which
  // would make this branch dead exactly where the live-origin path matters.
  const base = !import.meta.server && import.meta.dev ? window.location.origin : appConfig.site.url;
  if (!base) {
    return;
  }

  // The OG image is addressed purely by content path; the route
  // (`src/server/routes/_og/[...slug].get.ts`) loads the card meta itself from
  // the content index. `/` maps to the `_index` (landing) card.
  const path = route.path === "/" ? "/_index" : route.path;
  const canonicalURL = new URL(base);
  const ogURL = new URL(`/_og${path}.png`, canonicalURL);

  useSeoMeta({
    ogTitle: page.title,
    ogDescription: description,
    ogImage: {
      url: ogURL.href,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: description,
    },
    twitterCard: "summary_large_image",
    twitterDescription: description,
    twitterImage: {
      url: ogURL.href,
      width: 1200,
      height: 630,
      alt: description,
    },
  });

  useHead({
    link: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/icon.svg",
      },
    ],
  });

  // Prerender the page's OG image alongside its HTML. The card route is now
  // path-addressed and query-less (`/_og/<path>.png`), so Nitro can write it to
  // disk; hinting it via the `x-nitro-prerender` response header is the only way
  // it gets discovered (crawlLinks follows `<a href>`, not `<meta og:image>`).
  // No-op unless this render is a prerender pass (see `hintPrerenderRoute`).
  hintPrerenderRoute(ogURL.pathname);
}
