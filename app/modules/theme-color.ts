import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  setup(_, nuxt) {
    // Need to register the hook before tailwind module
    // TODO: upstream tailwind module should fire this once modules are loaded
    nuxt.hook('tailwindcss:config', (tailwindConfig) => {
      const themeColor = (tailwindConfig.theme?.extend?.colors as any)?.theme?.['500']
      if (!themeColor) {
        return
      }
      nuxt.options.app.head = nuxt.options.app.head || {}
      nuxt.options.app.head.meta = nuxt.options.app.head.meta || []
      nuxt.options.app.head.meta.push({ name: 'theme-color', content: themeColor })
    })
  },
})
