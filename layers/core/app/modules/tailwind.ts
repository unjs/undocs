import { defineNuxtModule } from 'nuxt/kit'

// Remove deprecated color warnings for Bun
// https://github.com/nuxt/ui/issues/809
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const defaultColors = _require('tailwindcss/colors.js')
delete defaultColors.lightBlue
delete defaultColors.warmGray
delete defaultColors.trueGray
delete defaultColors.coolGray
delete defaultColors.blueGray

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
