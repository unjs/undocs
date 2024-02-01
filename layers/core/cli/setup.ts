import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { NuxtConfig } from 'nuxt/schema'
import { getColors } from 'theme-colors'
import { loadConfig } from 'c12'
import type { DocsConfig } from '../schema'

const appDir = fileURLToPath(new URL('../app', import.meta.url))

export interface SetupDocsOptions {
  defaults?: DocsConfig
  extends?: string[]
}

export async function setupDocs(docsDir: string, opts: SetupDocsOptions = {}) {
  // Try to load docs config
  const docsconfig = (await loadDocsConfig(docsDir, opts.defaults)) || ({} as DocsConfig)

  // Normalize dir
  docsconfig.dir = docsDir = resolve(docsconfig.dir || docsDir)

  // Prepare loadNuxt overrides
  const nuxtConfig: NuxtConfig = {
    rootDir: resolve(docsDir, '.docs'),
    srcDir: resolve(docsDir, '.docs'),

    extends: [...(opts.extends || []), appDir, '@nuxt/ui-pro'],
    modulesDir: [resolve(appDir, '../node_modules'), resolve(docsDir, 'node_modules')],
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
    appConfig: {
      site: {
        name: docsconfig.name || '',
        description: docsconfig.description || '',
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

async function loadDocsConfig(dir: string, defaults: DocsConfig = {}) {
  const { config } = await loadConfig<DocsConfig>({
    name: 'docs',
    cwd: dir,
    defaults,
    overrides: { dir },
  })

  return config
}
