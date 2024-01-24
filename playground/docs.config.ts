import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'Docs Theme',
  description: 'Default documentation for UnJS package.',
  github: 'unjs/docs',
  redirects: {
    '/foo': '/bar',
  },
  // theme: '#ECDC5A',
  theme: '#f98007',
})
