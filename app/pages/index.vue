<script setup lang="ts">
import type { DocsConfig } from '../../config'

const { data: page } = await useAsyncData<DocsConfig['landing']>('index', () => queryContent('/').findOne())


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
  title: page.value.title,
  description: page.value.description,
})

if (process.server) {
  // @ts-ignore
  defineOgImageComponent('OgImageDocs')
}

const pageHero = computed(() => {
  if (!page.value?.hero) {
    return
  }
  return {
    title: page.value.hero._title,
    description: page.value.hero.text,
    links: Object.values(page.value.hero.links || {}),
    orientation: page.value.hero.code?.length ? 'horizontal' : 'vertical',
    code: (page.value.hero.code || []).map(c => `${"`".repeat(3)}${c.lang || 'sh'} [${c.title || 'Terminal'}]\n${c.content}\n${"`".repeat(3)}`).join('\n'),
  }
})
</script>

<template>
  <div>
    <ULandingHero v-if="pageHero" v-bind="pageHero">
      <template #title>
        <MDC :value="pageHero.title" />
      </template>

      <MDC
        v-if="pageHero.code"
        :value="pageHero.code"
        tag="pre"
        class="prose prose-primary dark:prose-invert mx-auto"
      />
    </ULandingHero>

    <template v-if="page.features">
      <ULandingSection :title="page.features.title" :links="page.features.links">
        <UPageGrid>
          <ULandingCard v-for="(item, index) of page.features.items" :key="index" v-bind="item" />
        </UPageGrid>
      </ULandingSection>
    </template>
  </div>
</template>
