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

const { data: sponsors } = await useAsyncData(() => useSponsors())
const { data: contributors } = await useAsyncData(() => useContributors())
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
        container: 'py-8 sm:py-12 lg:py-16',
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

    <UPageSection v-if="sponsors?.sponsors.length" title="Sponsors" class="bg-muted/30 border-y border-default">
      <div id="sponsors" class="flex flex-col items-center gap-8">
        <div
          v-for="(tier, i) of sponsors.sponsors.slice(0, 2)"
          :key="i"
          class="flex flex-wrap justify-center gap-8 max-w-4xl"
        >
          <div v-for="s in tier" :key="s.name" class="flex items-center gap-6 max-w-[300px]">
            <a
              :href="s.website"
              target="_blank"
              class="flex items-center gap-2 opacity-80 hover:opacity-100"
              :class="`font-size-${i === 0 ? '3xl' : i === 1 ? 'xl' : 'lg'}`"
            >
              <img
                v-if="s.image"
                :src="s.image"
                :alt="s.name"
                class="object-contain rounded-lg"
                :style="{
                  width: i === 0 ? '80px' : '48px',
                  height: i === 0 ? '80px' : '48px',
                }"
              />
              <span v-if="i < 2" class="font-semibold" :class="`text-${i === 0 ? '2xl' : 'xl'}`">{{ s.name }}</span>
            </a>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
          <UTooltip v-for="s in sponsors.sponsors[2]" :key="s.name" :text="s.name" :delay-duration="0">
            <a :href="s.website" target="_blank" class="opacity-80 hover:opacity-100">
              <UAvatar :alt="s.name" :src="s.image" size="2xl" />
            </a>
          </UTooltip>
        </div>
        <div class="flex flex-wrap justify-center gap-1">
          <UTooltip v-for="s in sponsors.sponsors[3]" :key="s.name" :text="s.name" :delay-duration="0">
            <a :href="s.website" target="_blank" class="opacity-80 hover:opacity-100">
              <UAvatar :alt="s.name" :src="s.image" />
            </a>
          </UTooltip>
        </div>
      </div>
      <div class="text-center">
        <UButton
          v-if="sponsors.username"
          icon="i-lucide-heart-handshake"
          :to="`https://github.com/sponsors/${sponsors.username}`"
          target="_blank"
          color="neutral"
        >
          Become a Sponsor
        </UButton>
      </div>
    </UPageSection>

    <UPageSection v-if="contributors?.length" id="contributors" title="Contributors">
      <div class="flex flex-wrap justify-center gap-2">
        <UTooltip v-for="c in contributors" :key="c.username" :text="c.name" :delay-duration="0">
          <a :href="c.profile" target="_blank" class="opacity-80 hover:opacity-100">
            <UAvatar :alt="c.name" :src="c.avatar" size="3xl" />
          </a>
        </UTooltip>
      </div>
      <div class="text-center">
        <UButton
          v-if="landing._github"
          :to="`https://github.com/${landing._github}`"
          target="_blank"
          color="neutral"
          icon="i-lucide-git-pull-request"
        >
          Contribute on GitHub
        </UButton>
      </div>
    </UPageSection>
  </div>
</template>
