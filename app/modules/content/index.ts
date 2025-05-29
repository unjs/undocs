import { defineNuxtModule } from 'nuxt/kit'
import type { DocsConfig } from '../../../schema/config'
import { setupContentHooks } from './hooks'

export default defineNuxtModule({
  async setup(_, nuxt) {
    if (nuxt.options._prepare) {
      return
    }

    const docsConfig = (nuxt.options as any).docs as DocsConfig

    await setupContentHooks(nuxt, docsConfig)

    if (docsConfig.landing === false) {
      nuxt.hooks.hook('pages:extend', (pages) => {
        const index = pages.findIndex((page) => page.path === '/')
        if (index !== -1) {
          pages.splice(index, 1)
        }
      })
    }

    // @ts-ignore
    globalThis.__undocs__ = { docsConfig }
  },
})
