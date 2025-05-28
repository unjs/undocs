import { defineNuxtModule, createResolver, useNitro } from 'nuxt/kit'
import type { DocsConfig } from '../../../schema/config'
import { setupContentHooks } from './hooks'

export default defineNuxtModule({
  async setup(_, nuxt) {
    if (nuxt.options._prepare) {
      return
    }

    const resolver = createResolver(import.meta.url)

    const docsConfig = (nuxt.options as any).docs as DocsConfig

    nuxt.options.nitro.externals ||= {}
    nuxt.options.nitro.externals.inline ||= []
    nuxt.options.nitro.externals.inline.push(resolver.resolve('./runtime'))

    await setupContentHooks(nuxt, docsConfig)

    if (docsConfig.landing === false) {
      nuxt.hooks.hook('pages:extend', (pages) => {
        const index = pages.findIndex((page) => page.path === '/')
        if (index !== -1) {
          pages.splice(index, 1)
        }
      })
    }

    // Inject globalThis.__undocs__ for same process + nitro runtime
    // @ts-ignore
    globalThis.__undocs__ = { docsConfig }
    nuxt.hook('nitro:init', (nitro) => {
      nitro.options.plugins.push(resolver.resolve('./runtime/nitro.mjs'))
      nitro.options.runtimeConfig.__undocs__ = { docsConfig }
    })

    // HMR
    // @ts-ignore
    nuxt.hook('undocs:config' as any, (newConfig: DocsConfig) => {
      Object.assign(docsConfig, newConfig)
      const nitro = useNitro()
      nitro.updateConfig({
        // @ts-expect-error TODO: temp fix for nitro
        experimental: {},
        runtimeConfig: {
          ...nitro.options.runtimeConfig,
          __undocs__: { docsConfig },
        },
      })
    })
  },
})
