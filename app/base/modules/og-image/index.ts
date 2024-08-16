import { addServerHandler, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  setup(_, nuxt) {
    if (nuxt.options._prepare) {
      return
    }
    const resolver = createResolver(import.meta.url)

    addServerHandler({
      route: '/_og/**',
      handler: resolver.resolve('./runtime/handler'),
    })

    nuxt.options.nitro.serverAssets ??= []
    nuxt.options.nitro.serverAssets.push({
      baseName: 'og-image',
      dir: resolver.resolve('./runtime/assets'),
    })

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('prerender:generate', (route) => {
        if (route.route.startsWith('/_og/')) {
          // temp patch for nitro prerenderer
          route.route = route.route.split('?')[0]
          route.fileName = route.fileName.split('?')[0]
        }
      })
    })
  },
})
