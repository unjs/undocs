import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'UnJS Docs',
  description: 'Docs, made easy.',
  github: 'unjs/docs',
  redirects: {
    '/foo': '/bar',
  },
  themeColor: '#f98007',
  landing: {
    hero: {
      text: 'Elegant documentation tooling for UnJS Docs',
      code: [
        { content: `npx giget@latest gh:unjs/docs/template docs` }
      ]
    },
  }
})
