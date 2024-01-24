import { loadConfig, createDefineConfig } from 'c12'

export interface DocsConfig {
  name?: string
  description?: string
  github?: string
  redirects?: Record<string, string>
}

export const defineDocsConfig = createDefineConfig<DocsConfig>()

export async function loadDocsConfig(dir: string) {
  const { config } = await loadConfig<DocsConfig>({
    name: 'docs',
    cwd: dir,
  })

  return config
}
