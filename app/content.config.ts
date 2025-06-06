import { defineContentConfig, defineCollection } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: {
        cwd: globalThis.__DOCS_CWD__,
        include: '**/*.{md,yml}',
        exclude: ['**/.**/**', '**/node_modules/**', '**/dist/**', '**/.docs/**'],
      },
    }),
  },
})
