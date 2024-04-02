<script setup lang="ts">
import { withoutTrailingSlash } from 'ufo'

definePageMeta({
  layout: 'docs',
})

const appConfig = useAppConfig()
const route = useRoute()

const { data: page } = await useAsyncData(route.path, () => queryContent(route.path).findOne())

if (!page.value) {
  showError({
    statusCode: 404,
    statusMessage: `Page not found: ${route.path}`,
  })
}

const { data: surround } = await useAsyncData(`${route.path}-surround`, () =>
  queryContent()
    .where({ _extension: 'md', navigation: { $ne: false } })
    .only(['title', 'description', '_path'])
    .findSurround(withoutTrailingSlash(route.path)),
)

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  ogTitle: page.value?.title,
  description: page.value?.description,
})

const headline = computed(() => findPageHeadline(page.value))

const tocOpen = ref(false)
const tocLinks = computed(() =>
  (page.value.body?.toc?.links || []).map((link) => ({
    label: link.text,
    href: `#${link.id}`,
  })),
)

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}
const isMobile = ref(false)
onMounted(() => {
  isMobile.value = 'ontouchstart' in document.documentElement
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader :title="page.title" :description="page.description" :links="page.links" :headline="headline">
    </UPageHeader>

    <div
      v-if="tocLinks.length > 1"
      class="float-right mt-4 top-[calc(var(--header-height)_+_0.5rem)] z-10 flex justify-end sticky"
    >
      <UDropdown
        :items="[[{ label: 'Return to top', click: scrollToTop }], tocLinks]"
        :popper="{ placement: 'bottom-end' }"
        :mode="isMobile ? 'click' : 'hover'"
        v-model:open="tocOpen"
      >
        <UButton
          color="white"
          label="On this page"
          :trailing="false"
          :icon="`i-heroicons-chevron-${tocOpen ? 'down' : 'left'}-20-solid`"
        />
      </UDropdown>
    </div>

    <UPageBody prose>
      <br v-if="tocLinks.length > 1" />

      <ContentRenderer v-if="page.body" :value="page" />

      <div class="space-y-6">
        <UDivider type="dashed" />
        <div class="mb-4">
          <UPageLinks
            class="inline-block"
            :links="[
              {
                icon: 'i-ph-pen-duotone',
                label: 'Edit this page on GitHub',
                to: `https://github.com/${appConfig.docs.github}/edit/main/docs/${page._file}`,
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
