import { loadConfig, createDefineConfig } from 'c12'

type Color = `#${string}`

export interface DocsConfig {
  name?: string
  description?: string
  github?: string
  redirects?: Record<string, string>
  /**
   * The theme color of the documentation site.
   * It will be used as the `theme-color` meta tag and a full palette of colors will be generated from it.
   *
   * @example '#ECDC5A'
   */
  theme?: Color
}

export const defineDocsConfig = createDefineConfig<DocsConfig>()

export async function loadDocsConfig(dir: string) {
  const { config } = await loadConfig<DocsConfig>({
    name: 'docs',
    cwd: dir,
  })

  return config
}
