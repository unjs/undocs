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
   * The description of the documentation site.
   *
   * @example 'Docs, Made Easy.'
   */
  shortDescription?: string

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
    /** Page title */
    title?: string

    /** Page description */
    description?: string

    /** Full hero title (auto generated markdown) */
    _heroMdTitle?: string

    /** main title (default is same as page title) */
    heroTitle?: string

    /** second hero title (default is same as shortDescription) */
    heroSubtitle?: string

    /** Additional text in hero (default is same as description) */
    heroDescription?: string

    /** Hero Links */
    heroLinks?: Record<string, string | { label?: string; icon?: string; to?: string; size?: string; order?: number }>

    /** Hero Codes */
    heroCode?: string | { content: string; title?: string; lang?: string }

    /** Features section title */
    featuresTitle?: string

    /** Features section description */
    features?: { title: string; description?: string; icon?: string }[]
  }
}
