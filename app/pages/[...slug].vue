<script setup lang="ts">
import { kebabCase } from 'scule'
import { findPageHeadline } from '#ui-pro/utils/content'

definePageMeta({
  layout: 'docs',
})

const appConfig = useAppConfig()
const route = useRoute()

const { data: page } = await useAsyncData(kebabCase(route.path), () =>
  queryCollection('content').path(route.path).first(),
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    message: `${route.path} does not exist`,
    fatal: true,
  })
}

const { data: surround } = await useAsyncData(`${kebabCase(route.path)}-surround`, () => {
  return queryCollectionItemSurroundings('content', route.path, {
    fields: ['description'],
  })
})

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  ogTitle: page.value?.title,
  description: page.value?.description,
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :links="page.links"
      :headline="findPageHeadline(page)"
    />

    <template #right>
      <UContentToc title="On this page" :links="page.body?.toc?.links || []" highlight />
    </template>

    <UPageBody prose class="break-words">
      <ContentRenderer v-if="page.body" :value="page" />

      <div class="space-y-6">
        <USeparator type="dashed" />
        <div class="mb-4">
          <UPageLinks
            class="inline-block"
            :links="[
              {
                icon: 'i-ph-pen-duotone',
                label: `Edit this page ${page.automd ? '(some contents are generated with automd from source)' : ''}`,
                to: `https://github.com/${appConfig.docs.github}/edit/${appConfig.docs.branch || 'main'}/docs/${page.id.replace(/^content\//, '')}`,
                target: '_blank',
              },
            ]"
          />
        </div>
        <UContentSurround v-if="surround?.length" class="mb-4" :surround="surround" />
      </div>
    </UPageBody>
  </UPage>
</template>
