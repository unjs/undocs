import { defineNuxtConfig } from 'nuxt/config'

// Flag enabled when developing docs theme
const dev = !!process.env.NUXT_DOCS_DEV

// https://github.com/unjs/std-env/issues/59
process.env.NUXT_PUBLIC_SITE_URL =
  process.env.NUXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) || // Vercel
  process.env.URL || // Netlify
  process.env.CI_PAGES_URL || // Gitlab Pages
  process.env.CF_PAGES_URL // Cloudflare Pages

if (!dev && !process.env.NUXT_PUBLIC_SITE_URL) {
  console.warn('NUXT_PUBLIC_SITE_URL env variable is not set!')
}

export default defineNuxtConfig({
  extends: ['@nuxt/ui-pro'],
  modules: [
    '@nuxt/content',
    '@nuxthq/studio',
    '@nuxtjs/fontaine',
    '@nuxtjs/google-fonts',
    '@nuxtjs/seo',
    '@nuxtjs/plausible',
    (_, nuxt) => {
      // need to register the hook before tailwind module
      // TODO: upstream tailwind module should fire this once modules are loaded
      nuxt.hook('tailwindcss:config', (tailwindConfig) => {
        if (tailwindConfig.theme?.extend?.colors?.theme?.['500']) {
          nuxt.options.app.head = nuxt.options.app.head || {}
          nuxt.options.app.head.meta = nuxt.options.app.head.meta || []
          const themeColor = {
            name: 'theme-color',
            content: tailwindConfig.theme.extend.colors.theme['500'],
          }
          nuxt.options.app.head.meta.push(themeColor)
        }
      })
    },
    '@nuxt/ui',
  ],
  ui: {
    icons: ['heroicons', 'simple-icons', 'mdi', 'material-symbols', 'fa', 'ph'],
  },
  fontMetrics: {
    fonts: ['Nunito'],
  },
  googleFonts: {
    display: 'swap',
    download: true,
    families: {
      Nunito: [400, 500, 600, 700],
    },
  },
  app: {
    head: {
      htmlAttrs: {
        dir: 'ltr',
        class: 'scroll-smooth',
      },
      templateParams: {
        separator: '·',
      }
    }
  },
  content: {
    highlight: {
      theme: {
        default: 'min-dark',
        light: 'min-light',
      },
    },
  },
  routeRules: {
    '/api/search.json': { prerender: true },
  },
  nitro: {
    prerender: {
      autoSubfolderIndex: false,
    },
  },
  devtools: {
    enabled: dev,
  },
  uiPro: {
    license: process.env.NUXT_UI_PRO_LICENSE || 'oss',
  },
  ogImage: {
    fonts: [
      'Nunito:400',
      'Nunito:700',
    ],
  },
  seo: {
    splash: false,
  },
  site: {
    identity: {
      type: 'Organization',
      name: 'UnJS',
      url: 'https://unjs.io',
      logo: 'https://unjs.io/favicon.svg',
      sameAs: [
        'https://github.com/unjs',
        'https://x.com/unjsio',
      ],
    },
  },
  tailwindcss: {
    viewer: dev,
    quiet: !dev,
  },
  typescript: {
    strict: false,
    includeWorkspace: true,
  },
})
