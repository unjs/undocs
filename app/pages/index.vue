<script setup lang="ts">
import type { DocsConfig } from '../../schema/config'
import { defu } from 'defu'

type LandingConfig = Exclude<DocsConfig['landing'], false | undefined>

const appConfig = useAppConfig()

const docsConfig = appConfig.docs as DocsConfig

// console.log('docsConfig', JSON.stringify(docsConfig, null, 2))

const landing: LandingConfig & { _github: string } = defu(docsConfig.landing || {}, {
  // Meta
  navigation: false,

  // Page
  title: docsConfig.name,
  description: docsConfig.description,

  // Hero
  heroTitle: docsConfig.name,
  heroSubtitle: docsConfig.shortDescription,
  heroDescription: docsConfig.description,
  heroLinks: {
    primary: {
      label: 'Get Started',
      icon: 'i-heroicons-rocket-launch',
      to: '/guide',
      order: 0,
    },
    github: {
      label: 'View on GitHub',
      icon: 'i-simple-icons-github',
      color: 'white',
      to: `https://github.com/${docsConfig.github}`,
      target: '_blank',
      order: 100,
    },
  },

  // Features
  featuresTitle: '',
  features: [],

  _github: docsConfig.github,
})

landing._heroMdTitle =
  landing._heroMdTitle || `[${landing.heroTitle}]{.text-primary} :br [${landing.heroSubtitle}]{.text-4xl}`

usePageSEO({
  title: `${appConfig.site.name} - ${landing!.heroSubtitle}`,
  ogTitle: landing!.heroSubtitle,
  description: landing!.description,
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

const hero = computed(() => {
  if (!landing!._heroMdTitle) {
    return
  }
  const withFeatures = !landing!.heroCode && landing.featuresLayout === 'hero' && landing.features?.length > 0
  return {
    title: landing!._heroMdTitle,
    description: landing!.heroDescription,
    links: nornalizeHeroLinks(landing!.heroLinks),
    withFeatures,
    orientation: landing!.heroCode || withFeatures ? 'horizontal' : 'vertical',
    code: landing!.heroCode,
  } as const
})
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero
      v-if="hero"
      :orientation="hero.orientation"
      class="relative"
      :ui="{
        container: '!pb-20 py-24 sm:py-32 lg:py-40',
        title: 'text-5xl sm:text-7xl',
        wrapper: 'lg:min-h-[540px]',
      }"
    >
      <template #top>
        <LandingBackground />
      </template>

      <template #title>
        {{ landing.heroTitle }}<br /><span class="text-primary text-4xl">{{ landing.heroSubtitle }}</span>
      </template>

      <template #description>
        {{ landing.heroDescription }}
      </template>

      <template #links>
        <div class="flex flex-col gap-4">
          <div class="flex items-center flex-wrap gap-2">
            <UButton v-for="link in hero.links" :key="link.label" v-bind="link" class="!px-6 !py-3"> </UButton>
          </div>
        </div>
      </template>

      <ProseCodeGroup v-if="hero.code" class="mx-auto" style="max-width: 100%">
        <ProsePre :filename="hero.code.title || 'Terminal'" :code="hero.code.content">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-html="hero.code.contentHighlighted"></span>
        </ProsePre>
      </ProseCodeGroup>

      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <UPageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" />
      </div>
    </UPageHero>

    <!-- Features -->

    <UPageSection
      v-if="landing.features?.length > 0"
      :title="landing?.featuresTitle"
      :description="''"
      :ui="{
        title: 'text-left',
        description: 'text-left',
        root: '',
        features: 'xl:grid-cols-4 lg:gap-10',
      }"
    >
      <template #features>
        <li v-for="feature in landing.features" :key="feature.title">
          <UPageFeature v-bind="feature" orientation="vertical">
            <template #leading>
              <template v-if="feature.icon">
                <span v-if="/\p{Emoji}/u.test(feature.icon)" class="w-8 h-8 text-2xl">
                  {{ feature.icon }}
                </span>
                <UIcon v-else :name="feature.icon" class="w-8 h-8" />
              </template>
            </template>
            <template #description>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="md" v-html="feature.description" />
            </template>
          </UPageFeature>
        </li>
      </template>
    </UPageSection>

    <UPageSection v-if="landing.contributors && landing._github" title="Made by community">
      <div class="flex justify-center">
        <a :href="`https://github.com/${landing._github}/graphs/contributors`" target="_blank">
          <img :src="`https://contrib.rocks/image?repo=${landing._github}`" />
        </a>
      </div>
    </UPageSection>
  </div>
</template>
