<script setup lang="ts">
import type { DocsConfig } from '../../schema'

type LandingConfig = NonNullable<DocsConfig['landing']>

const { data: page } = (await useAsyncData('index', () => queryContent('/').findOne())) as unknown as {
  data: Ref<LandingConfig>
}

if (!page.value) {
  showError({
    statusCode: 404,
    statusMessage: 'Home page not found!',
  })
}

useHead({
  titleTemplate: '%s %separator UnJS',
})

useSeoMeta({
  title: page.value!.title,
  description: page.value!.description,
})

if (process.server) {
  // @ts-ignore
  defineOgImageComponent('OgImageDocs')
}

function nornalizeHeroLinks(links: LandingConfig['heroLinks']) {
  return Object.entries(links || {})
    .map(([key, link], order) => {
      if (!link) {
        return
      }
      if (typeof link === 'string') {
        link = { to: link }
      }
      return {
        label: toLabel(key),
        order,
        target: link.to?.startsWith('https') ? '_blank' : undefined,
        ...link,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.order - b!.order) as any[]
}

function formatHeroCode(code: LandingConfig['heroCode']) {
  if (!code) {
    return
  }
  if (typeof code === 'string') {
    code = { content: code }
  }
  return `${'`'.repeat(3)}${code.lang || 'sh'} [${code.title || 'Terminal'}]\n${code.content}\n${'`'.repeat(3)}`
}

const hero = computed(() => {
  if (!page.value!._heroMdTitle) {
    return
  }
  const code = formatHeroCode(page.value!.heroCode)
  return {
    title: page.value!._heroMdTitle,
    description: page.value!.heroDescription,
    links: nornalizeHeroLinks(page.value!.heroLinks),
    orientation: code ? 'horizontal' : 'vertical',
    code,
  } as const
})
</script>

<template>
  <ULandingHero v-if="hero" v-bind="hero">
    <template #title>
      <MDC :value="hero.title" />
    </template>

    <MDC v-if="hero.code" :value="hero.code" tag="pre" class="prose prose-primary dark:prose-invert mx-auto" />
  </ULandingHero>

  <template v-if="page.features?.length > 0">
    <ULandingSection :title="page.featuresTitle">
      <UPageGrid>
        <ULandingCard v-for="(item, index) of page.features" :key="index" v-bind="item" />
      </UPageGrid>
    </ULandingSection>
  </template>
</template>
