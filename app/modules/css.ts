import { defineNuxtModule, addTemplate, createResolver } from '@nuxt/kit'
import { joinURL } from 'ufo'
import { resolveModulePath } from 'exsolve'

export default defineNuxtModule({
  meta: {
    name: 'css',
  },
  async setup(_options, nuxt) {
    const dir = nuxt.options.rootDir
    const resolver = createResolver(import.meta.url)

    const contentDir = joinURL(dir, '../')
    const uiPath = resolveModulePath('@nuxt/ui', { from: import.meta.url, conditions: ['style'] })
    const tailwindPath = resolveModulePath('tailwindcss', { from: import.meta.url, conditions: ['style'] })
    const layerDir = resolver.resolve('../')

    const cssTemplate = addTemplate({
      filename: 'undocs.css',
      getContents: () => {
        return `@import ${JSON.stringify(tailwindPath)};
@import ${JSON.stringify(uiPath)};

@source "${contentDir.replace(/\\/g, '/')}/**/*.md";
@source "${layerDir.replace(/\\/g, '/')}/**/*";
@source "../../app.config.ts";`
      },
    })

    nuxt.options.css.unshift(cssTemplate.dst)
  },
})
