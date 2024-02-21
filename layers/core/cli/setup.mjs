import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
// import type { NuxtConfig } from 'nuxt/schema'
import { getColors } from 'theme-colors'
import { loadConfig } from 'c12'
// import type { DocsConfig } from '../../../schema/config'

const appDir = fileURLToPath(new URL('../app', import.meta.url))
const pkgDir = fileURLToPath(new URL('../../..', import.meta.url))

// export interface SetupDocsOptions {
//   defaults?: DocsConfig
//   dev?: boolean
//   extends?: string[]
// }

export async function setupDocs(docsDir, opts = {}) {
  // Try to load docs config
  const docsconfig = (await loadDocsConfig(docsDir, opts.defaults)) || ({})

  // Normalize dir
  docsconfig.dir = docsDir = resolve(docsconfig.dir || docsDir)

  // URL is required for production build (SEO)
  if (!docsconfig.url && !opts.dev) {
    throw new Error('`url` config is required for production build!')
  }

  // Prepare loadNuxt overrides
  const nuxtConfig = {
    rootDir: resolve(docsDir, '.docs'),
    srcDir: resolve(docsDir, '.docs'),

    extends: [...(opts.extends || []), appDir, '@nuxt/ui-pro'],
    modulesDir: [resolve(pkgDir, 'node_modules'), resolve(docsDir, 'node_modules')],
    build: {
      transpile: [appDir],
    },
    // @ts-ignore
    docs: docsconfig,
    // @ts-ignore
    googleFonts: {
      families: {
        Nunito: [400, 500, 600, 700], // in layer, it duplicates. why? (god knows?)
      },
    },
    // @ts-ignore
    site: {
      name: docsconfig.name || '',
      description: docsconfig.description || '',
      url: docsconfig.url,
    },
    appConfig: {
      site: {
        name: docsconfig.name || '',
        description: docsconfig.description || '',
        url: docsconfig.url,
      },
      docs: {
        github: docsconfig.github,
      },
    },
    nitro: {
      static: true,
      publicAssets: [{ baseURL: '/', dir: resolve(docsDir, '.docs/public'), maxAge: 0 }],
    },
    routeRules: {
      ...Object.fromEntries(Object.entries(docsconfig.redirects || {}).map(([from, to]) => [from, { redirect: to }])),
    },
    tailwindcss: {
      config: {
        theme: {
          extend: {
            colors: docsconfig.themeColor ? { theme: getColors(docsconfig.themeColor) } : undefined,
          },
        },
      },
    },
  }

  return {
    docsDir,
    appDir,
    nuxtConfig,
  }
}

async function loadDocsConfig(dir, defaults = {}) {
  const { config } = await loadConfig({
    name: 'docs',
    cwd: dir,
    defaults: {
      url: inferSiteURL(),
      ...defaults,
    },
    overrides: { dir },
  })

  return config
}

function inferSiteURL() {
  // https://github.com/unjs/std-env/issues/59
  return (
    process.env.NUXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) || // Vercel
    process.env.URL || // Netlify
    process.env.CI_PAGES_URL || // Gitlab Pages
    process.env.CF_PAGES_URL // Cloudflare Pages
  )
}
