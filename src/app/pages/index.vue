<script setup lang="ts">
import { computed } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { queryBlog, queryPage } from "@app/composables/useContent.ts";
import { usePageSEO } from "@app/composables/usePageSEO.ts";
import { titleCase } from "@app/utils/title.ts";
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
import type { DocsConfig } from "../../../schema/config.d.ts";
import { defu } from "defu";

type LandingConfig = Exclude<DocsConfig["landing"], false | undefined>;

const appConfig = useAppConfig();

const docsConfig = appConfig.docs as DocsConfig;

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
      label: "Get Started",
      icon: "i-lucide-rocket",
      to: "/guide",
      order: 0,
    },
    github: {
      label: "View on GitHub",
      icon: "i-simple-icons-github",
      color: "white",
      to: `https://github.com/${docsConfig.github}`,
      target: "_blank",
      order: 100,
    },
  },

  // Features
  featuresTitle: "",
  features: [],

  _github: docsConfig.github,
});

landing._heroMdTitle =
  landing._heroMdTitle ||
  `[${landing.heroTitle}]{.text-brand} :br [${landing.heroSubtitle}]{.text-4xl}`;

usePageSEO({
  title: `${appConfig.site.name} - ${landing!.heroSubtitle}`,
  description: landing!.description,
});

// On mobile the hero links stack; emphasize the first (primary) action and
// demote the rest to minimal links so they don't read as a wall of buttons.
// `sm:` and up keep the default `lg` button look.
const heroPrimaryLinkClass = "max-sm:h-12 max-sm:w-full max-sm:text-base";
const heroSecondaryLinkClass =
  "max-sm:h-auto max-sm:w-auto max-sm:self-center max-sm:border-transparent " +
  "max-sm:bg-transparent max-sm:px-0 max-sm:py-1 max-sm:font-normal max-sm:shadow-none " +
  "max-sm:text-muted-foreground max-sm:hover:text-foreground " +
  "max-sm:underline max-sm:underline-offset-4";

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
      // The lead CTA carries the docs' accent (`color: "brand"`, the one
      // accent-filled button in the set — see `Button.ts`). Keyed on POSITION,
      // like `heroPrimaryLinkClass` in the template, so it follows whichever link
      // actually renders first rather than the built-in `primary` key; a config
      // link that names its own `color` still wins, since `link` spreads last.
      .map((link, index) => (index === 0 ? { color: "brand", ...link } : link)) as any[]
  );
}

const hero = computed(() => {
  if (!landing!._heroMdTitle) {
    return;
  }
  const withFeatures =
    !landing!.heroCode && landing.featuresLayout === "hero" && landing.features?.length > 0;
  return {
    title: landing!._heroMdTitle,
    description: landing!.heroDescription,
    links: normalizeHeroLinks(landing!.heroLinks),
    withFeatures,
    orientation: landing!.heroCode || withFeatures ? "horizontal" : "vertical",
    code: landing!.heroCode,
  } as const;
});

/**
 * The features block as a Geist grid (vercel.com/geist/grid) — a feature
 * breakdown is one of the three layouts Geist scopes `Grid` to.
 *
 * Unlike a Tailwind `grid-cols-3`, Geist's grid draws its rule lines whether or
 * not a cell occupies the track, so the ROW count has to be stated per
 * breakpoint: it is how many rows the cards wrap into at that column count, not
 * something the browser derives. A feature count that doesn't divide evenly
 * leaves empty cells in the last row, guides and all — that is the intended
 * look, not a gap to paper over.
 *
 * `corners` are the four line intersections of the whole grid. They are grid
 * LINES (1..n+1), and the right/bottom ones move with the breakpoint, so each
 * cross carries its own responsive coordinates.
 */
const featureGrid = computed(() => {
  const count = landing.features?.length || 0;
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

// The landing's own content. Both are awaited — they ARE the page — so they are
// started together rather than one `await` after the other: on a client-side
// navigation these are two serial round-trips holding the page's `<Suspense>`,
// and nothing here depends on the other's result.
//
// The blocks below the fold (sponsors, contributors) do NOT block: they fetch
// third-party data through our proxies and pass `{ lazy: true }` so a slow one
// can't hold the hero. See `useAsyncData`.
const [{ data: latest }, { data: root }] = await Promise.all([
  useAsyncData("blog-latest", () => queryBlog().then((res) => res[0] || null)),

  // Optional root content: if the docs set has a root `index.md`, render its body
  // below the hero. `queryPage("/")` returns null when there's no root page (the
  // landing then stays purely hero/features-driven). Param-less, so it also
  // prerenders `/api/docs/page/_index.json` — but only when it exists (the
  // recorder hints on 2xx only, see `recordingFetch`).
  useAsyncData("index", () => queryPage("/")),
]);
</script>

<template>
  <div>
    <!-- Hero -->
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

      <template #links>
        <Button
          v-for="(link, index) in hero.links"
          :key="link.label"
          v-bind="link"
          :class="index === 0 ? heroPrimaryLinkClass : heroSecondaryLinkClass"
        />
      </template>

      <ProseCodeGroup v-if="hero.code" class="mx-auto" style="max-width: 100%">
        <ProsePre
          :filename="hero.code.title || 'Terminal'"
          :code="hero.code.content"
          :highlighted="hero.code.contentHighlighted"
        />
      </ProseCodeGroup>

      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <!-- sr-only heading so the cards' <h3>s don't skip a level under the hero <h1> -->
        <h2 class="sr-only">{{ landing.featuresTitle || "Features" }}</h2>
        <PageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" />
      </div>
    </PageHero>

    <!-- Root index.md content (rendered only when the docs set has a root page) -->
    <Container v-if="root?.body">
      <PageBody prose class="break-words">
        <MarkdownRenderer :value="root" />
      </PageBody>
    </Container>

    <!-- Features -->

    <PageSection
      v-if="landing.features?.length > 0"
      :title="landing.featuresTitle || undefined"
      :sr-title="landing.featuresTitle || 'Features'"
      :ui="{
        container: 'pt-4 sm:pt-8 lg:pt-12',
        body: 'mt-0',
      }"
    >
      <!-- `role="list"` rather than a real `<ul>`: the grid's `GridCross`
           markers are children of the same element, and only `<li>` may be a
           child of `<ul>`. The crosses are `aria-hidden`, so they are not
           owned by the list in the accessibility tree. -->
      <GridSystem>
        <Grid role="list" :columns="featureGrid.columns" :rows="featureGrid.rows">
          <GridCross v-for="(corner, index) in featureGrid.corners" :key="index" v-bind="corner" />
          <GridCell v-for="feature in landing.features" :key="feature.title" role="listitem">
            <PageFeature v-bind="feature" orientation="vertical">
              <template #leading>
                <template v-if="feature.icon">
                  <span v-if="/\p{Emoji}/u.test(feature.icon)" class="w-8 h-8 text-2xl">
                    {{ feature.icon }}
                  </span>
                  <Icon v-else :name="feature.icon" class="w-8 h-8" />
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
    <PageContributors v-if="docsConfig.landing?.contributors" />
  </div>
</template>
