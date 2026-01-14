<script setup lang="ts">
  import { joinURL } from 'ufo'
import { kebabCase } from 'scule'
import type { ContentNavigationItem } from '@nuxt/content'

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

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

// console.log(JSON.stringify(navigation?.value, null, 2))

function makeBreadcrumb(items: ContentNavigationItem[], path: string, level = 0) {
  const parent = [...items].find((i) => path.startsWith(i.path) && i.children?.length > 0)
  if (!parent) {
    return []
  }
  if (level === 0) {
    return makeBreadcrumb(parent.children, path, level + 1)
  }
  return [
    {
      label: parent.title,
      icon: parent.icon as string,
      to: parent.page !== false ? parent.path : '',
    },
    ...makeBreadcrumb(parent.children, path, level + 1),
  ]
}

const breadcrumb = computed(() => makeBreadcrumb(navigation?.value || [], page.value.path))

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  ogTitle: page.value?.title,
  description: page.value?.description,
})

const path = computed(() => route.path.replace(/\/$/, ''))
prerenderRoutes([joinURL('/raw', `${path.value}.md`)])
useHead({
  link: [
    {
      rel: 'alternate',
      href: joinURL(appConfig.site.url, 'raw', `${path.value}.md`),
      type: 'text/markdown'
    }
  ]
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :ui="{
        wrapper: 'flex-row items-center flex-wrap justify-between',
      }"
    >
      <template #headline>
        <UBreadcrumb :items="breadcrumb" />
      </template>
      <template #links>
        <UButton v-for="(link, index) in page.links" :key="index" size="sm" v-bind="link" />

        <PageHeaderLinks />
      </template>
    </UPageHeader>

    <template v-if="page.body?.toc?.links?.length" #right>
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
