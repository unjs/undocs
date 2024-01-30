<script setup lang="ts">
const { data: page } = await useAsyncData('index', () => queryContent('/').findOne())

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Index page not found',
    fatal: true,
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
</script>

<template>
  <div>
    <ULandingHero v-if="page.hero" v-bind="page.hero">
      <template #title>
        <MDC :value="page.hero.title" />
      </template>

      <MDC
        v-if="page.hero.code"
        :value="page.hero.code"
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
