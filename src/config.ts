import { loadConfig, createDefineConfig } from 'c12'

type ColorVariant = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
type Color = `#${string}`


export interface DocsConfig {
  name?: string
  description?: string
  github?: string
  redirects?: Record<string, string>
  theme?: Record<ColorVariant, Color>
}

export const defineDocsConfig = createDefineConfig<DocsConfig>()

export async function loadDocsConfig(dir: string) {
  const { config } = await loadConfig<DocsConfig>({
    name: 'docs',
    cwd: dir,
  })

  return config
}
