<script setup lang="ts">
import type { DocsConfig } from '../../schema/config'

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

const appConfig = useAppConfig()

usePageSEO({
  title: `${appConfig.site.name} - ${page.value!.heroSubtitle}`,
  ogTitle: page.value!.heroSubtitle,
  description: page.value!.description,
})

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
        label: titleCase(key),
        order,
        size: 'lg',
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
  const withFeatures = !code && page.value.featuresLayout === 'hero' && page.value.features?.length > 0
  return {
    title: page.value!._heroMdTitle,
    description: page.value!.heroDescription,
    links: nornalizeHeroLinks(page.value!.heroLinks),
    withFeatures,
    orientation: code || withFeatures ? 'horizontal' : 'vertical',
    code,
  } as const
})
</script>

<template>
  <div>
    <ULandingHero v-if="hero" v-bind="hero" :orientation="hero.orientation">
      <template #top>
        <LandingBackground />
      </template>
      <template #title>
        <MDC :value="hero.title" />
      </template>

      <MDC v-if="hero.code" :value="hero.code" tag="pre" class="prose prose-primary dark:prose-invert mx-auto" />
      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <ULandingCard v-for="(item, index) of page.features" :key="index" v-bind="item" />
      </div>
    </ULandingHero>

    <template v-if="page.features?.length > 0 && !hero.withFeatures">
      <ULandingSection :title="page.featuresTitle">
        <UPageGrid>
          <ULandingCard
            v-for="(item, index) of page.features"
            :key="index"
            v-bind="item"
            :ui="{
              icon: {
                // If the icon is an emoji, we need to use a bigger size
                base: /\p{Emoji}/u.test(item.icon)
                  ? '!text-2xl !w-auto !h-auto'
                  : 'w-8 h-8 flex-shrink-0 text-gray-900 dark:text-white',
              },
            }"
          >
            <template v-if="item.description" #description>
              <MDC :value="item.description" tag="span" class="prose prose-primary dark:prose-invert" />
            </template>
          </ULandingCard>
        </UPageGrid>
      </ULandingSection>
    </template>

    <ULandingSection v-if="page.contributors && page._github" title="Made by community">
      <UContainer>
        <a :href="`https://github.com/${page._github}/graphs/contributors`" target="_blank">
          <img :src="`https://contrib.rocks/image?repo=${page._github}`" />
        </a>
      </UContainer>
    </ULandingSection>
  </div>
</template>
