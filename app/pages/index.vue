<script setup lang="ts">
import type { DocsConfig } from '../../schema/config'
import { defu } from 'defu'

type LandingConfig = Exclude<DocsConfig['landing'], false | undefined>

const appConfig = useAppConfig()

const docsConfig = appConfig.docs as DocsConfig

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

function normalizeHeroLinks(links: LandingConfig['heroLinks']) {
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
    links: normalizeHeroLinks(landing!.heroLinks),
    withFeatures,
    orientation: landing!.heroCode || withFeatures ? 'horizontal' : 'vertical',
    code: landing!.heroCode,
  } as const
})

const { data: latest } = await useAsyncData(() =>
  queryCollection('content')
    .where('path', 'LIKE', '/blog/%')
    .order('id', 'DESC')
    .first()
    .then((res) => res),
)
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero v-if="hero" :orientation="hero.orientation" class="relative" :links="hero.links">
      <template #top>
        <LandingBackground />
      </template>

      <template #headline>
        <UButton
          v-if="latest"
          :to="latest.path"
          variant="subtle"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
          class="rounded-full"
        >
          {{ latest.title }}
        </UButton>
      </template>

      <template #title>
        {{ landing.heroTitle }}<br /><span v-if="landing.heroSubtitle" class="text-primary text-4xl">{{
          landing.heroSubtitle
        }}</span>
      </template>

      <template #description>
        {{ landing.heroDescription }}
      </template>

      <template #links>
        <UButton v-for="link in hero.links" :key="link.label" v-bind="link" />
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
      :ui="{
        container: 'pt-4 sm:pt-8 lg:pt-12',
        body: 'mt-0',
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

    <PageSponsors v-if="docsConfig.sponsors?.api" />
    <PageContributors v-if="docsConfig.landing?.contributors" />
  </div>
</template>
