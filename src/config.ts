import { loadConfig, createDefineConfig } from 'c12'

export interface DocsConfig {
  /**
   * The name of the documentation site.
   *
   * @example 'UnJS Docs'
   */
  name?: string
  /**
   * The description of the documentation site.
   *
   * @example 'Default documentation for UnJS package.'
   */
  description?: string
  /**
   * The GitHub repository for the documentation site.
   *
   * @example 'unjs/docs'
   */
  github?: string
  /**
   * Redirects for the documentation site.
   *
   * @example { '/foo': '/bar' }
   */
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
