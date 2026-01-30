import { createResolver } from 'nuxt/kit'
import { defineNuxtConfig } from 'nuxt/config'
import { eventHandler } from 'h3'

const { resolve } = createResolver(import.meta.url)

// Flag enabled when developing docs theme
const dev = !!process.env.NUXT_DOCS_DEV

// SSR enabled only for production build to save life (at least until our stack will be a little bit lighter)
const isProd = process.env.NODE_ENV === 'production'
const ssr = Boolean(isProd || process.env.NUXT_DOCS_SSR)

export default defineNuxtConfig({
  $meta: {
    name: 'undocs',
  },
  ssr,
  modules: ['@nuxt/ui', isProd && '@nuxtjs/plausible', 'nuxt-llms'],
  css: [resolve('./assets/main.css')],
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'important'],
    },
  },
  app: {
    head: {
      htmlAttrs: {
        dir: 'ltr',
      },
      templateParams: {
        separator: '·',
      },
    },
  },
  content: {
    experimental: {
      sqliteConnector: 'native',
    },
    build: {
      markdown: {
        highlight: {
          theme: {
            default: 'github-dark',
            dark: 'github-dark',
            light: 'github-light',
          },
          // prettier-ignore
          langs: ['json', 'json5', 'jsonc', 'toml', 'yaml', 'html', 'sh', 'shell', 'bash', 'mdc', 'markdown', 'md', 'vue', 'js', 'ts', 'javascript', 'typescript', 'ini', 'diff', 'jsx', 'tsx'],
        },
      },
    },
  },
  nitro: {
    devHandlers: [
      {
        route: '/.well-known/appspecific/com.chrome.devtools.json',
        handler: eventHandler(() => ({})),
      },
    ],
    prerender: {
      autoSubfolderIndex: false,
      failOnError: false,
    },
  },
  devtools: {
    enabled: dev,
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
