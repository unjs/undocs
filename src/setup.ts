import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { NuxtConfig } from 'nuxt/schema'
import { getColors } from 'theme-colors'
import { type DocsConfig, loadDocsConfig } from './config'

const appDir = fileURLToPath(new URL('../app', import.meta.url))

export async function setupDocs(dir: string) {
  // Try to load docs config
  const docsconfig = (await loadDocsConfig(dir)) || {} as DocsConfig

  // Normalize dir
  docsconfig.dir = dir = resolve(docsconfig.dir || dir)

  // Prepare loadNuxt overrides
  const overrides = <NuxtConfig>{
    rootDir: dir,
    extends: [appDir],
    modulesDir: [resolve(appDir, '../node_modules'), resolve(dir, 'node_modules')],
    build: {
      transpile: [appDir],
    },
    docs: docsconfig,
    appConfig: {
      site: {
        name: docsconfig.name || '',
        description: docsconfig.description || '',
      },
      docs: {
        github: docsconfig.github || '',
      },
    },
    nitro: {
      static: true,
      publicAssets: [{ baseURL: '/', dir: resolve(dir, 'public'), maxAge: 0 }],
    },
    routeRules: {
      ...Object.fromEntries(Object.entries(docsconfig.redirects || {}).map(([from, to]) => [from, { redirect: to }])),
    },
    tailwindcss: {
      config: {
        theme: {
          extend: {
            colors: {
              theme: getColors(docsconfig.themeColor || '#ECDC5A'),
            },
          },
        },
      },
    },
  }

  return {
    dir,
    overrides,
  }
}
