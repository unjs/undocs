import { defineNuxtModule } from 'nuxt/kit'
import type { DocsConfig } from '../../schema/config'

export default defineNuxtModule({
  setup(_, nuxt) {
    if (nuxt.options._prepare) {
      return
    }

    const docsConfig = (nuxt.options as any).docs as DocsConfig

    const uiConfig = {
      primary: docsConfig.themeColor || 'amber',
      gray: 'neutral',
    }

    // if (docsConfig.themeColor) {
    //   const { getColors } = await import('theme-colors')
    //   const colors = getColors(docsConfig.themeColor)
    //   // UI
    //   // uiConfig.primary = colors['500']
    //   // Tailwind
    //   nuxt.options.tailwindcss ||= {} as any
    //   nuxt.options.tailwindcss.config ||= {}
    //   nuxt.options.tailwindcss.config.theme ||= {}
    //   nuxt.options.tailwindcss.config.theme.extend ||= {}
    //   nuxt.options.tailwindcss.config.theme.extend.colors = {
    //     ...colors,
    //     ...nuxt.options.tailwindcss.config.theme.extend.colors,
    //   }
    // }

    nuxt.hook('ready', () => {
      nuxt.options.appConfig.ui = {
        ...nuxt.options.appConfig.ui,
        ...uiConfig,
      }
    })

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
