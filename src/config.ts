import { loadConfig, createDefineConfig } from 'c12'

export interface DocsConfig {
  /**
   * Documentation directory
   *
   * Note: This option will be automatically set
   */
  dir?: string

  /**
   * The name of the documentation site.
   *
   * @example 'UnJS Docs'
   */
  name?: string

  /**
   * The description of the documentation site.
   *
   * @example 'Default documentation for UnJS package'
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

  /**
   * The theme color of the documentation site.
   * It will be used as the `theme-color` meta tag and a full palette of colors will be generated from it.
   *
   * @example '#ECDC5A'
   * @example 'rgb(236, 220, 90)'
   */
  themeColor?: string

  /**
   * Landing page configuration
   */
  landing?: {
    /** page title */
    title?: string
    /** page description */
    description?: string
    hero?: {
      /** full title (auto generated) */
      _title?: string
      /** main title (default is same as page title) */
      title?: string
      /** second title (kep it short. default is same as page description) */
      description?: string
      /** Additional text */
      text?: string
      /** Action Links */
      links?: Record<string, { label: string; icon?: string; to?: string; size?: string }>
      /** Hero Codes */
      code?: { content: string; title?: string; lang?: string }[]
    }
    features?: {
      title?: string
      items?: { title: string; description?: string; icon?: string }[]
    }
  }
}

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
