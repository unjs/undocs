<script setup lang="ts">
import { kebabCase } from 'scule'

definePageMeta({
  layout: 'blog',
})

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

const appConfig = useAppConfig()

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  ogTitle: page.value?.title,
  description: page.value?.description,
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader v-bind="page" :ui="{ headline: 'flex flex-col gap-y-8 items-start' }">
      <template #headline>
        <UBreadcrumb
          :items="[{ label: 'Blog', icon: 'i-lucide-newspaper', to: '/blog' }, { label: page.title }]"
          class="max-w-full"
        />
        <div class="flex items-center space-x-2">
          <span>
            {{ page.meta.category }}
          </span>
          <span class="text-muted"
            >&nbsp;&middot;&nbsp;<time>{{ page.meta.date }}</time></span
          >
        </div>
      </template>
      <div class="mt-4 flex flex-wrap items-center gap-6">
        <UUser
          v-for="(author, index) in page.meta.authors || []"
          :key="index"
          :name="author.name"
          :avatar="{ src: `https://github.com/${author.github}.png?size=64` }"
          :to="`https://github.com/${author.github}`"
          target="_blank"
          :description="author.to ? `@${author.to.split('/').pop()}` : undefined"
        />
      </div>
    </UPageHeader>
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
      </div></div
  ></UPage>
</template>
