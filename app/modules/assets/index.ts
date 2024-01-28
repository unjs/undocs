import { createResolver, defineNuxtModule, addServerHandler, addPrerenderRoutes } from 'nuxt/kit'
import { createInstructions, preset } from './utils'

interface AssetsModuleOptions {}

/**
 * Generate icons for every platform. Use a single `icon.svg` file as source placed in the `public` folder.
 * It uses Nitro endpoint to serve the icons in development and prerender them on build time.
 */
export default defineNuxtModule<AssetsModuleOptions>({
  meta: {
    name: 'assets',
    configKey: 'assets',
  },
  defaults: {},
  async setup (_, nuxt) {
  const { resolve } = createResolver(import.meta.url)

  // We only want URL so no need for a real image.
  const images = await createInstructions(preset)

  for (const route of Object.keys(images)) {
    addServerHandler({
      route,
      handler: resolve('./runtime/server/assets.get.ts')
    })
  }

  nuxt.options.app.head.link = nuxt.options.app.head.link || []
  for (const image of Object.values(images)) {
    const sizes = image.width ? `${image.width}x${image.height}` : 'any'

    nuxt.options.app.head.link.push({
      rel: image.linkObject.rel,
      href: image.linkObject.href,
      sizes,
      type: image.mimeType
    })
  }

  // Prerender images
  addPrerenderRoutes(Object.keys(images))
}
})
