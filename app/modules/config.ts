import { defineNuxtModule, createResolver } from 'nuxt/kit'

export default defineNuxtModule({
  async setup(_, nuxt) {
    const docs = (nuxt.options as any).docs || {}
    if (!docs.dir) {
      throw new Error('docs.dir is not defined! are you using cli?')
    }
    const userResolver = createResolver(docs.dir)
    const userConfig = await userResolver.resolvePath('app.config')
    nuxt.hooks.hook('app:resolve', (app) => {
      app.configs.unshift(userConfig)
    })
  },
})
