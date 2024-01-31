import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'UnJS Docs',
  description: 'Elegant documentation tooling for UnJS Docs',
  shortDescription: 'Docs, made easy.',
  github: 'unjs/docs',
  redirects: {
    '/getting-started': '/guide',
  },
  landing: {
    heroCode: `npx giget@latest gh:unjs/docs/template docs`,
    heroLinks: {
      stackblitz: {
        icon: 'i-heroicons-play',
        to: 'https://stackblitz.com/github/unjs/docs/tree/main/template',
      },
    },
    features: [
      {
        title: 'Eazy to use',
        description: 'Focus on building your docs, not tooling.',
      },
      {
        title: 'Using best of best',
        description: 'Made with Nuxt, Nuxt Content, [Nuxt SEO and Nuxt UI Pro.',
      },
    ],
  },
})
