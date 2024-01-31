import { join } from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'

// Flag enabled when developing docs theme
const dev = !!process.env.NUXT_DOCS_DEV

// SSR enabled only for production build to save life (at least until our stack will be little bit lighter)
const isProd = process.env.NODE_ENV === 'production'
const ssr = Boolean(isProd || process.env.NUXT_DOCS_SSR)

// https://github.com/unjs/std-env/issues/59
process.env.NUXT_PUBLIC_SITE_URL =
  process.env.NUXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) || // Vercel
  process.env.URL || // Netlify
  process.env.CI_PAGES_URL || // Gitlab Pages
  process.env.CF_PAGES_URL // Cloudflare Pages

if (!dev && !process.env.NUXT_PUBLIC_SITE_URL) {
  console.warn('`NUXT_PUBLIC_SITE_URL` env variable is not set!')
}

export default defineNuxtConfig({
  ssr,
  extends: ['@nuxt/ui-pro'],
  modules: [
    '@nuxt/content',
    '@nuxthq/studio',
    '@nuxtjs/fontaine',
    '@nuxtjs/google-fonts',
    '@nuxtjs/seo',
    isProd && '@nuxtjs/plausible',
    '@nuxt/ui',
  ],
  ui: {
    icons: ['mdi', 'heroicons', 'ph', 'simple-icons'],
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
      'node_modules',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      '\\.(js|mjs|ts)$',
    ],
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
    identity: {
      type: 'Organization',
      name: 'UnJS',
      url: 'https://unjs.io',
      logo: 'https://unjs.io/favicon.svg',
      sameAs: ['https://github.com/unjs', 'https://x.com/unjsio'],
    },
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
    config: {
      content: {
        // eslint-disable-next-line unicorn/prefer-module
        files: [join(__dirname, '{components,pages,layouts}/**/*.vue')],
      },
    },
  },
  typescript: {
    strict: false,
    includeWorkspace: true,
  },
})
