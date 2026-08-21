<script setup lang="ts">
import { computed, inject, watch, type Ref } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useLocaleDocsConfig } from "@app/composables/useLocaleDocsConfig.ts";
import { useI18nDisableMeta } from "@app/composables/useI18nDisableMeta.ts";
import { useUndocsT } from "@app/composables/useUndocsT.ts";
import { queryBlog, queryPage } from "@app/composables/useContent.ts";
import { usePageSEO } from "@app/composables/usePageSEO.ts";
import { useRoute } from "@app/router.ts";
import { titleCase } from "@app/utils/title.ts";
import { isColoredIcon, isEmojiIcon } from "@app/utils/icons.ts";
import Button from "@app/components/ui/Button.vue";
import Container from "@app/components/Container.vue";
import Grid from "@app/components/grid/Grid.vue";
import GridCell from "@app/components/grid/GridCell.vue";
import GridCross from "@app/components/grid/GridCross.vue";
import GridSystem from "@app/components/grid/GridSystem.vue";
import Icon from "@app/components/global/Icon.vue";
import MarkdownRenderer from "@app/content/MarkdownRenderer.ts";
import PageBody from "@app/components/layout/PageBody.vue";
import PageCard from "@app/components/blocks/PageCard.vue";
import PageContributors from "@app/components/blocks/PageContributors.vue";
import PageFeature from "@app/components/blocks/PageFeature.vue";
import PageHero from "@app/components/blocks/PageHero.vue";
import PageSection from "@app/components/blocks/PageSection.vue";
import PageSponsors from "@app/components/blocks/PageSponsors.vue";
import ProseCodeGroup from "@app/content/ProseCodeGroup.vue";
import ProsePre from "@app/content/ProsePre.vue";
import { firstDocsPage } from "@app/utils/nav.ts";
import type { DocsConfig } from "../../../schema/config.d.ts";
import type { NavItem } from "@server/content/types.ts";
import { defu } from "defu";

type LandingConfig = Exclude<DocsConfig["landing"], boolean | undefined>;

const route = useRoute();
const appConfig = useAppConfig();
const localeDocs = useLocaleDocsConfig();
const disableMetaRef = useI18nDisableMeta();
const { t } = useUndocsT();

const docsConfig = computed(() => localeDocs.value as DocsConfig);

// Boolean landing values only toggle the route; only object values configure this page.
const landingConfig = computed<LandingConfig>(() =>
  typeof docsConfig.value.landing === "object" && docsConfig.value.landing
    ? docsConfig.value.landing
    : {},
);

// Derive the default CTA from rendered nav so it cannot point to `/`; omit it for empty docs.
const navigation = inject<Ref<NavItem[]>>("navigation");
const startPath = firstDocsPage(navigation?.value);

const landing = computed(() => {
  const cfg = docsConfig.value;
  const lc = landingConfig.value;
  const merged: LandingConfig & { _github: string } = defu(lc, {
    navigation: false,

    title: cfg.name,
    description: cfg.description,

    heroTitle: cfg.name,
    heroSubtitle: cfg.shortDescription,
    heroDescription: cfg.description,
    heroLinks: {
      ...(startPath && {
        primary: {
          label: "Get Started",
          icon: "i-lucide-rocket",
          to: startPath,
          order: 0,
        },
      }),
      github: {
        label: "View on GitHub",
        icon: "i-simple-icons-github",
        color: "white",
        to: `https://github.com/${cfg.github}`,
        target: "_blank",
        order: 100,
      },
    },

    featuresTitle: "",
    features: [],

    _github: cfg.github,
  });

  merged._heroMdTitle =
    merged._heroMdTitle ||
    `[${merged.heroTitle}]{.text-brand} :br [${merged.heroSubtitle}]{.text-4xl}`;
  return merged;
});

usePageSEO({
  title: `${localeDocs.value.name || appConfig.site.name} - ${landing.value.heroSubtitle}`,
  description: landing.value.description || localeDocs.value.description || "",
});

// Landing has no page frontmatter for disableMeta — keep locale SEO on.
watch(
  () => route.path,
  () => {
    disableMetaRef.value = false;
  },
  { immediate: true },
);

function normalizeHeroLinks(links: LandingConfig["heroLinks"]) {
  return (
    Object.entries(links || {})
      .map(([key, link], order) => {
        if (!link) {
          return;
        }
        if (typeof link === "string") {
          link = { to: link };
        }
        return {
          label: titleCase(key),
          order,
          size: "lg",
          target: link.to?.startsWith("https") ? "_blank" : undefined,
          ...link,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.order - b!.order)
      // Position, not config key, identifies the lead CTA; explicit config wins.
      .map((link, index) =>
        index === 0 ? { color: "brand", variant: "solid", ...link } : link,
      ) as any[]
  );
}

const hero = computed(() => {
  const L = landing.value;
  if (!L._heroMdTitle) {
    return;
  }
  const withFeatures = !L.heroCode && L.featuresLayout === "hero" && (L.features?.length ?? 0) > 0;
  return {
    title: L._heroMdTitle,
    description: L.heroDescription,
    links: normalizeHeroLinks(L.heroLinks),
    withFeatures,
    orientation: L.heroCode || withFeatures ? "horizontal" : "vertical",
    code: L.heroCode,
  } as const;
});

// Grid draws empty tracks, so responsive row counts and corner lines are explicit.
const featureGrid = computed(() => {
  const count = landing.value.features?.length || 0;
  const columns = { sm: 1, md: 2, lg: 3 };
  const rows = {
    sm: Math.max(1, count),
    md: Math.max(1, Math.ceil(count / 2)),
    lg: Math.max(1, Math.ceil(count / 3)),
  };
  const first = { sm: 1, md: 1, lg: 1 };
  const right = { sm: columns.sm + 1, md: columns.md + 1, lg: columns.lg + 1 };
  const bottom = { sm: rows.sm + 1, md: rows.md + 1, lg: rows.lg + 1 };
  return {
    columns,
    rows,
    corners: [
      { column: first, row: first },
      { column: right, row: first },
      { column: first, row: bottom },
      { column: right, row: bottom },
    ],
  };
});

// Fetch page-owned content in parallel; third-party blocks below remain lazy.
const [{ data: latest }, { data: root }] = await Promise.all([
  useAsyncData("blog-latest", () => queryBlog().then((res) => res[0] || null)),

  // Locale-aware root page under the hero (e.g. `/ru` index.md).
  useAsyncData(`index:${localeDocs.value._locale}`, () => queryPage(route.path || "/")),
]);
</script>

<template>
  <div>
    <PageHero v-if="hero" :orientation="hero.orientation" class="relative" :links="hero.links">
      <template #headline>
        <Button
          v-if="latest"
          :to="latest.path"
          variant="subtle"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
          class="rounded-full"
        >
          {{ latest.title }}
        </Button>
      </template>

      <template #title>
        {{ landing.heroTitle }}<br /><span
          v-if="landing.heroSubtitle"
          class="text-brand text-4xl"
          >{{ landing.heroSubtitle }}</span
        >
      </template>

      <template #description>
        {{ landing.heroDescription }}
      </template>

      <ProseCodeGroup v-if="hero.code" class="hero-code mx-auto" style="max-width: 100%">
        <ProsePre
          :filename="hero.code.title || 'Terminal'"
          :code="hero.code.content"
          :highlighted="hero.code.contentHighlighted"
        />
      </ProseCodeGroup>

      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <h2 class="sr-only">{{ landing.featuresTitle || t("landing.features") }}</h2>
        <PageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" />
      </div>
    </PageHero>

    <Container v-if="root?.body">
      <PageBody prose class="break-words">
        <MarkdownRenderer :value="root" />
      </PageBody>
    </Container>

    <PageSection
      v-if="landing.features?.length > 0"
      :title="landing.featuresTitle || undefined"
      :sr-title="landing.featuresTitle || t('landing.features')"
      :ui="{
        container: 'pt-4 sm:pt-8 lg:pt-12',
        body: 'mt-0',
      }"
    >
      <!-- GridCross siblings preclude ul/li markup; aria-hidden keeps them outside the list. -->
      <GridSystem>
        <Grid role="list" :columns="featureGrid.columns" :rows="featureGrid.rows">
          <GridCross v-for="(corner, index) in featureGrid.corners" :key="index" v-bind="corner" />
          <GridCell v-for="feature in landing.features" :key="feature.title" role="listitem">
            <PageFeature v-bind="feature" orientation="vertical">
              <template #leading>
                <!-- Desaturate colored art, not currentColor icons that inherit brand. -->
                <template v-if="feature.icon">
                  <span v-if="isEmojiIcon(feature.icon)" class="w-8 h-8 text-2xl grayscale">
                    {{ feature.icon }}
                  </span>
                  <Icon
                    v-else
                    :name="feature.icon"
                    :class="['w-8 h-8', isColoredIcon(feature.icon) && 'grayscale']"
                  />
                </template>
              </template>
              <template #description>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="md" v-html="feature.description" />
              </template>
            </PageFeature>
          </GridCell>
        </Grid>
      </GridSystem>
    </PageSection>

    <PageSponsors v-if="docsConfig.sponsors?.api" />
    <PageContributors v-if="landing.contributors" />
  </div>
</template>

<style scoped>
/* The landing's sole glass pane. Blur only its outer surface; keep the CTA and
 * docs code opaque. Translucency requires blur and >60% muted for syntax contrast. */
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .hero-code {
    background: color-mix(in oklab, var(--muted) 62%, transparent);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, var(--foreground) 10%, transparent),
      0 12px 32px -24px color-mix(in oklab, var(--foreground) 28%, transparent);
  }

  .hero-code :deep(.prose-pre) {
    background: transparent;
  }

  .hero-code :deep(.code-group-tabs) {
    background: color-mix(in oklab, var(--card) 45%, transparent);
  }

  .hero-code :deep(.code-group-tabs [data-active]) {
    background: color-mix(in oklab, var(--background) 55%, transparent);
  }

  .hero-code :deep(.prose-pre > button) {
    background: color-mix(in oklab, var(--background) 60%, transparent);
  }
}
</style>
