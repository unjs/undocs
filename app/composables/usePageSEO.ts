export interface PageMeta {
  title: string
  ogTitle: string
  description: string
}

export function usePageSEO(page: PageMeta) {
  const route = useRoute()
  const appConfig = useAppConfig()

  useSeoMeta({
    title: page.title,
    description: page.description,
  })

  if (!(import.meta.server || import.meta.dev || import.meta.prerender)) {
    return
  }

  const path = route.path === '/' ? '/_index' : route.path
  const canonicalURL = import.meta.dev ? useRequestURL() : appConfig.site.url
  const ogURL = new URL(`/_og${path}.png`, canonicalURL)

  ogURL.searchParams.set('name', appConfig.site.name)
  ogURL.searchParams.set('title', page.ogTitle || page.title || appConfig.site.name)
  ogURL.searchParams.set('description', page.description || appConfig.site.description || '')

  useSeoMeta({
    ogImage: {
      url: ogURL.href,
      width: 1200,
      height: 600,
      type: 'image/png',
      alt: page.description || appConfig.site.description,
    },
    twitterImage: {
      url: ogURL.href,
      width: 1200,
      height: 600,
      alt: page.description || appConfig.site.description,
    },
  })

  if (import.meta.prerender) {
    prerenderRoutes(ogURL.pathname + ogURL.search)
    ogURL.searchParams.delete('name')
    ogURL.searchParams.delete('title')
    ogURL.searchParams.delete('description')
  }
}
