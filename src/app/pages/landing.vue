<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { queryBlog, queryPage } from "@app/composables/useContent.ts";
import { usePageSEO } from "@app/composables/usePageSEO.ts";
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

const appConfig = useAppConfig();

const docsConfig = appConfig.docs as DocsConfig;

// `landing` doubles as an on/off switch (`true`/`false`), and by the time this
// page renders the switch has already been read (`useLanding` decides which page
// `/` gets). Only the object form carries settings, so a boolean is dropped and
// every default below applies.
const landingConfig: LandingConfig =
  typeof docsConfig.landing === "object" ? docsConfig.landing : {};

// Where "Get Started" goes: the first page of the docs, read from the navigation
// tree `app.vue` provides — the one the chrome renders, so the docs-root item is
// already stripped and the CTA cannot point back at this page. Read once at
// setup, like every other value in `landing` below: `app.vue` awaits the tree
// before rendering, so it is settled by the time this page exists.
//
// With no page to point at (an empty tree), the built-in link is dropped
// entirely rather than rendered dead — a config-supplied `heroLinks.primary`
// still stands on its own `to`.
const navigation = inject<Ref<NavItem[]>>("navigation");
const startPath = firstDocsPage(navigation?.value);

const landing: LandingConfig & { _github: string } = defu(landingConfig, {
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
      // The lead CTA carries the docs' accent (`color: "brand"` — see
      // `Button.ts`). Keyed on POSITION, like `PageHero`'s own
      // primary/secondary split, so it follows whichever link actually renders
      // first rather than the built-in `primary` key; a config link that names
      // its own `color` or `variant` still wins, since `link` spreads last.
      //
      // It takes the accent as a SOLID FILL — `bg-brand` under the measured
      // `--brand-foreground` label (see `tokens.css`) — so the docs' colour
      // leads the page as a shape rather than as a tint. It is the ONE
      // accent-filled button in the set; the variant is named rather than left
      // to the default so that stays legible here. Being opaque, it is not one
      // of the landing's glass panes: the fire behind it is the CTA's contrast,
      // not its material.
      .map((link, index) =>
        index === 0 ? { color: "brand", variant: "solid", ...link } : link,
      ) as any[]
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

      <ProseCodeGroup v-if="hero.code" class="hero-code mx-auto" style="max-width: 100%">
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
                <!-- Colored art (emoji, a multicolor Iconify set) is desaturated
                     so the grid reads as one; a `currentColor` icon is not,
                     since the filter would grey out its inherited `--brand`. -->
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
/*
 * The hero's one pane of frosted glass: the code block.
 *
 * It is the only surface on the site sitting IN the firelight
 * (`FireplaceBackground`, mounted for the landing only) that reads as a pane
 * over the backdrop rather than as a shape punched through it. Nowhere else
 * gets this: a docs page has nothing behind its code blocks to show through,
 * and a translucent block there is just a lighter one. The lead CTA is the
 * other element standing in the same firelight and it deliberately does NOT
 * take this treatment — it is a solid `--brand` fill, i.e. one of the shapes,
 * and the fire is its contrast rather than its material.
 *
 * Every value below is a `color-mix` toward `transparent` of the token the
 * element already used — the body is still `--muted`, the tab bar still
 * `--card`, the active tab still `--background`. So the block keeps its rung on
 * the surface ladder, and, since every token is declared per mode, nothing here
 * needs a `dark:` variant.
 *
 * Three things are deliberate:
 *
 * 1. THE BLUR IS ONE PER PANE. `backdrop-filter` samples up to the backdrop
 *    root, and per filter-effects-2 that is the document here — `isolation`,
 *    which `PageHero` sets, is NOT on the list that forms one, so the fire
 *    behind is in frame. A second filter on a surface INSIDE the pane would
 *    re-blur an already-blurred backdrop and buy another offscreen pass for it;
 *    the block's inner surfaces are TINTS over its one pane instead.
 * 2. `@supports` runs the enhancement way round. Without `backdrop-filter` the
 *    opaque tokens stay, because translucency alone is not the effect — it is
 *    just the fire showing through the code.
 * 3. Contrast holds because `test/content/theme.test.ts` pins every syntax
 *    colour against `--muted`, and the pane is >60% `--muted` over a backdrop
 *    the fire moves by single-digit alpha, so the effective surface stays
 *    within about a point of the token in both modes. Thinning that mix is what
 *    would break it, not the blur.
 */
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .hero-code {
    background: color-mix(in oklab, var(--muted) 62%, transparent);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    /* The glass edge — page light caught along the pane's top, a mix of
       `--foreground` like the fire itself, so it inverts with the page — plus a
       soft drop so the pane floats over the fire instead of being cut out of
       it. A raw `box-shadow` is safe here: this element carries no focus ring
       for it to displace. */
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, var(--foreground) 10%, transparent),
      0 16px 40px -20px color-mix(in oklab, var(--foreground) 45%, transparent);
  }

  /* The body's own `bg-muted` fill would be a second, opaque pane inside the
     first — the glass IS the block's surface now. */
  .hero-code :deep(.prose-pre) {
    background: transparent;
  }

  .hero-code :deep(.code-group-tabs) {
    background: color-mix(in oklab, var(--card) 45%, transparent);
  }

  .hero-code :deep(.code-group-tabs [data-active]) {
    background: color-mix(in oklab, var(--background) 55%, transparent);
  }

  /* The copy button sits ON the glass, so it only needs to stop being opaque —
     what is behind it is already frosted. */
  .hero-code :deep(.prose-pre > button) {
    background: color-mix(in oklab, var(--background) 60%, transparent);
  }
}
</style>
