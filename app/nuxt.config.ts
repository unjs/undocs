import { createResolver } from 'nuxt/kit'
import { defineNuxtConfig } from 'nuxt/config'

const { resolve } = createResolver(import.meta.url)

// Flag enabled when developing docs theme
const dev = !!process.env.NUXT_DOCS_DEV

// SSR enabled only for production build to save life (at least until our stack will be a little bit lighter)
const isProd = process.env.NODE_ENV === 'production'
const ssr = Boolean(isProd || process.env.NUXT_DOCS_SSR)

export default defineNuxtConfig({
  $meta: {
    name: 'undocs'
  },
  ssr,
  modules: ['@nuxt/ui-pro', '@nuxt/content', isProd && '@nuxtjs/plausible'],
  css: [resolve('./assets/main.css')],
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'important']
    }
  },
  fonts: {
    families: [{ name: 'Inter' }],
    defaults: {
      weights: [400, 500, 600, 700],
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
      },
    },
  },
  content: {
    build: {
      markdown: {
        highlight: {
          langs: ['json5', 'jsonc', 'toml', 'yaml', 'html', 'sh', 'shell', 'bash', 'mdc', 'markdown', 'md'],
        }
      }
    },
  },
  nitro: {
    prerender: {
      autoSubfolderIndex: false,
      failOnError: false,
    },
  },
  devtools: {
    enabled: dev,
  },
  uiPro: {
    license: process.env.NUXT_UI_PRO_LICENSE || 'oss',
  },
  typescript: {
    strict: false,
    includeWorkspace: true,
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
})
