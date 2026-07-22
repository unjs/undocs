export interface PageMeta {
  title: string;
  ogTitle: string;
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

  if (!(import.meta.server || import.meta.dev || import.meta.prerender)) {
    return;
  }

  const path = route.path === "/" ? "/_index" : route.path;
  const canonicalURL = import.meta.dev ? useRequestURL() : appConfig.site.url;
  const ogURL = new URL(`/_og${path}.png`, canonicalURL);

  ogURL.searchParams.set("name", appConfig.site.name);
  ogURL.searchParams.set("title", page.ogTitle || page.title || appConfig.site.name);
  ogURL.searchParams.set("description", description);

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

  if (import.meta.prerender) {
    prerenderRoutes(ogURL.pathname + ogURL.search);
    ogURL.searchParams.delete("name");
    ogURL.searchParams.delete("title");
    ogURL.searchParams.delete("description");
  }
}
