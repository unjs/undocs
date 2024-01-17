import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { NuxtConfig } from 'nuxt/schema'

const appDir = fileURLToPath(new URL('../app', import.meta.url))

export function setupDocs(dir: string) {
  dir = resolve(dir)

  // Prepare loadNuxt overrides
  const overrides = <NuxtConfig>{
    rootDir: dir,
    extends: [appDir],
    modulesDir: [resolve(appDir, '../node_modules'), resolve(dir, 'node_modules')],
    build: {
      transpile: [appDir],
    },
    docs: {
      dir,
    },
  }

  return {
    dir,
    overrides,
  }
}
