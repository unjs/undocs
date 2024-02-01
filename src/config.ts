import { loadConfig, createDefineConfig } from 'c12'
import type { DocsConfig } from '../schema/config'

export const defineDocsConfig = createDefineConfig<DocsConfig>()

export async function loadDocsConfig(dir: string) {
  const { config } = await loadConfig<DocsConfig>({
    name: 'docs',
    cwd: dir,
    defaults: {
      dir,
    },
  })

  return config
}
