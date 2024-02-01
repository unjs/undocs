import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'UnJS',
      url: 'https://unjs.io',
      logo: 'https://unjs.io/favicon.svg',
      sameAs: ['https://github.com/unjs', 'https://x.com/unjsio'],
    },
  },
})
