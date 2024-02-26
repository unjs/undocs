import { defineNuxtConfig } from 'nuxt/config'

// Flag enabled when developing docs theme
const dev = !!process.env.NUXT_DOCS_DEV

// SSR enabled only for production build to save life (at least until our stack will be little bit lighter)
const isProd = process.env.NODE_ENV === 'production'
const ssr = Boolean(isProd || process.env.NUXT_DOCS_SSR)

// Some modules are shameless and don't understand prepare mode and make nonsense warnings
const isPrepare = Boolean(process.env.NUXT_DOCS_PREPARE)

export default defineNuxtConfig({
  ssr,
  modules: [
    'nuxt-content-twoslash',
    '@nuxt/content',
    '@nuxtjs/fontaine',
    !isPrepare && '@nuxtjs/google-fonts',
    '@nuxtjs/seo',
    isProd && '@nuxtjs/plausible',
    '@nuxt/ui',
  ],
  ui: {
    icons: [],
  },
  fontMetrics: {
    fonts: ['Nunito'],
  },
  googleFonts: {
    display: 'swap',
    download: true,
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
    // .* and -* are ignored by default
    ignores: [
      'package.json',
      'dist',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
      'node_modules',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'docs.config.json',
      '\\.(js|mjs|ts)$',
    ],
    highlight: {
      langs: ['json5', 'jsonc', 'toml', 'yaml', 'html', 'sh', 'shell', 'bash', 'mdc', 'markdown', 'md'],
    },
  },
  routeRules: {
    '/api/search.json': { prerender: true },
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
  ogImage: {
    enabled: ssr,
    debug: false,
    fonts: ['Nunito:400', 'Nunito:700'],
  },
  seo: {
    splash: false,
  },
  schemaOrg: {
    enabled: ssr,
  },
  sitemap: {
    strictNuxtContentPaths: true,
  },
  linkChecker: {
    strictNuxtContentPaths: true,
    skipInspections: ['link-text'],
  },
  tailwindcss: {
    viewer: dev,
    quiet: !dev,
  },
  twoslash: {
    floatingVueOptions: {
      classMarkdown: 'prose prose-primary dark:prose-invert',
    },
    // Skip Twoslash in dev to improve performance.
    enableInDev: !dev,
    throws: false,
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
