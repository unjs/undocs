import type { BannerProps } from '@nuxt/ui'

export interface DocsConfig {
  dir?: string
  name?: string
  description?: string
  shortDescription?: string
  url?: string
  github?: string
  socials?: Record<string, string>
  branch?: string
  banner?: BannerProps
  versions?: { label: string; to: string; active?: boolean }[]
  themeColor?: string
  redirects?: Record<string, string>
  automd?: unknown
  buildCache?: boolean
  sponsors?: { api: string }
  landing?:
    | false
    | {
        title?: string
        description?: string
        _heroMdTitle?: string
        heroTitle?: string
        heroSubtitle?: string
        heroDescription?: string
        heroLinks?: Record<
          string,
          string | { label?: string; icon?: string; to?: string; size?: string; order?: number }
        >
        heroCode?: string | { content: string; title?: string; lang?: string }
        featuresTitle?: string
        featuresLayout?: 'default' | 'hero'
        features?: { title: string; description?: string; icon?: string }[]
        contributors?: boolean
      }
}
