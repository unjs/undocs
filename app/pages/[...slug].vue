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

const tocLinks = computed(() => {
  return (page.value.body?.toc?.links || []).map((link) => ({
    ...link,
    children: undefined,
  }))
})

const tocMobileOpen = ref(false)

const tocMobileLinks = computed(() => {
  return [
    [
      {
        label: 'Return to top',
        click: () => {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        },
      },
    ],
    (page.value.body?.toc?.links || []).map((link) => ({
      label: link.text,
      // href: `#${link.id}`,
      click: () => {
        tocMobileOpen.value = false
        document.getElementById(link.id)?.scrollIntoView({ behavior: 'smooth' })
      },
    })),
  ]
})

const isMobile = ref(false)

onMounted(() => {
  isMobile.value = 'ontouchstart' in document.documentElement
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader :title="page.title" :description="page.description" :links="page.links" :headline="headline" />

    <!-- TOC -->
    <!-- large screen -->
    <template v-if="tocLinks.length > 0" #right>
      <UContentToc title="On this page" :links="tocLinks" class="hidden lg:block" />
    </template>
    <!-- mobile -->
    <div
      v-if="tocMobileLinks.length > 1"
      class="float-right mt-4 top-[calc(var(--header-height)_+_0.5rem)] z-10 flex justify-end sticky mb-2 lg:hidden"
    >
      <UDropdown
        v-model:open="tocMobileOpen"
        :items="tocMobileLinks"
        :popper="{ placement: 'bottom-end' }"
        :mode="isMobile ? 'click' : 'hover'"
      >
        <UButton
          color="white"
          label="On this page"
          :trailing="false"
          :icon="`i-heroicons-chevron-${tocMobileOpen ? 'down' : 'left'}-20-solid`"
        />
      </UDropdown>
    </div>

    <UPageBody prose>
      <br v-if="tocMobileLinks.length > 1" class="lg:hidden mb-2" />
      <ContentRenderer v-if="page.body" :value="page" />

      <div class="space-y-6">
        <UDivider type="dashed" />
        <div class="mb-4">
          <UPageLinks
            class="inline-block"
            :links="[
              {
                icon: 'i-ph-pen-duotone',
                label: `Edit this page ${page.automd ? '(some contents are generated with automd from source)' : ''}`,
                to: `https://github.com/${appConfig.docs.github}/edit/${appConfig.docs.branch || 'main'}/docs/${page._file}`,
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
