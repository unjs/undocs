<script setup lang="ts">
import type { DocsConfig } from '../../schema/config'
import { defu } from 'defu'

type LandingConfig = Exclude<DocsConfig['landing'], false | undefined>

const appConfig = useAppConfig()

const docsConfig = appConfig.docs as DocsConfig

// console.log('docsConfig', JSON.stringify(docsConfig, null, 2))

const landing: LandingConfig = (defu(docsConfig.landing || {}, {
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
}))

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
  if (!landing!._heroMdTitle) {
    return
  }
  const code = formatHeroCode(landing!.heroCode)
  const withFeatures = !code && landing.featuresLayout === 'hero' && landing.features?.length > 0
  return {
    title: landing!._heroMdTitle,
    description: landing!.heroDescription,
    links: nornalizeHeroLinks(landing!.heroLinks),
    withFeatures,
    orientation: code || withFeatures ? 'horizontal' : 'vertical',
    code,
  } as const
})
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero v-if="hero" :orientation="hero.orientation" class="relative" :ui="{
      container: '!pb-20 py-24 sm:py-32 lg:py-40',
      title: 'text-5xl sm:text-7xl',
      wrapper: 'lg:min-h-[540px]'
    }">

      <template #headline>
        <!-- <LandingBackground /> -->
        <!-- <NuxtLink :to="'/todo'">
          <UBadge variant="subtle" size="lg"
            class="px-3 relative rounded-full font-semibold dark:hover:bg-primary-400/15 dark:hover:ring-primary-700">
            {{ landing.heroTitle }}
            <UIcon v-if="false" :name="'todo'" class="size-4 pointer-events-none" />
          </UBadge>
        </NuxtLink> -->
      </template>

      <template #title>
        {{ landing.heroTitle }}<br><span class="text-primary text-4xl">{{ landing.heroSubtitle }}</span>
      </template>

      <template #description>
        {{ landing.heroDescription }}
      </template>

      <template #links>
        <div class="flex flex-col gap-4">
          <div class="flex items-center flex-wrap gap-2">
            <UButton v-for="link in hero.links" :key="link.label" v-bind="link" class="!px-6 !py-3">
            </UButton>
          </div>
        </div>
      </template>

      <pre v-if="hero.code" class="prose prose-primary dark:prose-invert mx-auto" v-html="hero.code"></pre>

      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <UPageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" />
      </div>
    </UPageHero>

    <!-- Features -->

    <UPageSection :title="landing?.featuresTitle" :description="''" :ui="{
      title: 'text-left',
      description: 'text-left',
      root: 'bg-gradient-to-b border-t border-default from-muted dark:from-muted/40 to-default',
      features: 'xl:grid-cols-4 lg:gap-10'
    }">
      <template #features>
        <li v-for="(feature) in landing.features" :key="feature.title">
          <UPageFeature v-bind="feature" orientation="vertical">
            <template #description>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="md" v-html="feature.description" />
            </template>
          </UPageFeature>
        </li>
      </template>
    </UPageSection>

    <!--
    <template v-if="landing.features?.length > 0 && !hero.withFeatures">
      <UPageSection :title="landing.featuresTitle">
        <UPageGrid>
          <UPageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" :ui="{
            icon: {
              // If the icon is an emoji, we need to use a bigger size
              base: /\p{Emoji}/u.test(item.icon)
                ? '!text-2xl !w-auto !h-auto'
                : 'w-8 h-8 flex-shrink-0 text-gray-900 dark:text-white',
            },
          }">
            <template v-if="item.description" #description>
              <MDC :value="item.description" tag="span" class="prose prose-primary dark:prose-invert" />
            </template>
          </UPageCard>
        </UPageGrid>
      </UPageSection>
    </template>
 -->
    <UPageSection v-if="landing.contributors && landing._github" title="Made by community">
      <UPageContainer class="flex justify-center">
        <a :href="`https://github.com/${landing._github}/graphs/contributors`" target="_blank">
          <img :src="`https://contrib.rocks/image?repo=${landing._github}`" />
        </a>
      </UPageContainer>
    </UPageSection>
  </div>
</template>
