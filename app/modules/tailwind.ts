import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  setup(_, nuxt) {
    if (nuxt.options._prepare) {
      return
    }

    nuxt.hook('tailwindcss:config', (tailwindConfig) => {
      const themeColor = (tailwindConfig.theme?.extend?.colors as any)?.theme?.['500']
      if (themeColor) {
        nuxt.options.app.head = nuxt.options.app.head || {}
        nuxt.options.app.head.meta = nuxt.options.app.head.meta || []
        nuxt.options.app.head.meta.push({ name: 'theme-color', content: themeColor })
      }
    })
  },
})
