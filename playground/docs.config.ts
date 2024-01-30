import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'UnJS Docs',
  description: 'Docs, made easy.',
  github: 'unjs/docs',
  redirects: {
    '/getting-started': '/guide',
  },
  themeColor: '#f98007',
  landing: {
    hero: {
      text: 'Elegant documentation tooling for UnJS Docs',
      code: [
        { content: `npx giget@latest gh:unjs/docs/template docs` }
      ]
    },
    features: {
      title: 'Features',
      items: [
        {
          title: 'Eazy to use',
          description: 'Focus on building your docs, not tooling.'
        },
        {
          title: 'Using best of best',
          description: 'Made with Nuxt, Nuxt Content, [Nuxt SEO and Nuxt UI Pro.'
        }
      ]
    }
  }
})
