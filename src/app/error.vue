<script setup lang="ts">
import { computed, provide } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useHead, useSeoMeta } from "@unhead/vue";
import { queryNavigation } from "@app/composables/useContent.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { LANDING_KEY, resolveLanding } from "@app/composables/useLanding.ts";
import { docsNavTree } from "@app/utils/nav.ts";
import AppFooter from "@app/components/app/AppFooter.vue";
import AppHeader from "@app/components/app/AppHeader.vue";
import AppProvider from "@app/components/ui/AppProvider.vue";
import Button from "@app/components/ui/Button.vue";
import Icon from "@app/components/global/Icon.vue";
import Container from "@app/components/Container.vue";
import Main from "@app/components/layout/Main.vue";
import DocsSearch from "@app/components/docs/DocsSearch.vue";
import DocsSearchField from "@app/components/docs/DocsSearchField.vue";
import ClientOnly from "@app/components/app/ClientOnly.ts";
import AppLink from "@app/components/app/AppLink.ts";
import type { AppError } from "@app/composables/createError.ts";
import type { NotFoundData } from "@app/composables/useContent.ts";

const props = defineProps<{
  error: AppError<NotFoundData>;
}>();

useHead({
  htmlAttrs: {
    lang: "en",
  },
});

const { data: navigation } = await useAsyncData("navigation", () => queryNavigation());

// The error page renders the same chrome as `app.vue` (header, section tabs,
// search), so it has to seed the same two injections, the same way — see
// `app.vue` for what the landing flag decides and how it shapes the tree.
const appConfig = useAppConfig();
const landing = computed(() => resolveLanding(appConfig.docs, navigation.value));
const docsNavigation = computed(() => docsNavTree(navigation.value, landing.value));

provide("navigation", docsNavigation);
provide(LANDING_KEY, landing);

const statusCode = computed(() => props.error?.statusCode || 404);
const notFound = computed(() => statusCode.value === 404);
const message = computed(
  () => props.error?.message || props.error?.statusMessage || "This page could not be found.",
);

useSeoMeta({
  title: () => (notFound.value ? "Page not found" : "An error occurred"),
  description: "We are sorry but this page could not be found.",
});

/** The path the visitor asked for, as they would have typed it. */
const requestedPath = computed(() => decodePath(props.error?.data?.path || ""));

// A 404 the server could not resolve to one page still knows the near misses
// (`pageNotFound`), so the page becomes a results list, best match first —
// plain `<a href>` links, which is also what an agent reading the HTML follows.
const suggestions = computed(() => (notFound.value ? (props.error?.data?.suggestions ?? []) : []));
const bestMatch = computed(() => suggestions.value[0]);
const otherMatches = computed(() => suggestions.value.slice(1));

function targetOf(item: { path: string; hash?: string }): string {
  return item.path + (item.hash || "");
}

/** Breadcrumbs arrive `>`-joined; the site's own separator is `›`. */
function crumbOf(item: { breadcrumb?: string }): string {
  return item.breadcrumb?.split(" > ").join(" › ") || "";
}

function decodePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * The guess's last segment as search words (`/1.guide/deploy-vercel.html` →
 * `deploy vercel`), so "search further" picks up where the guess left off. Only
 * the last segment: parents are section names every page under them shares, so
 * they would only narrow an AND search. Bounded like the server's guess, since
 * the path is whatever the visitor typed.
 */
const guessQuery = computed(() => {
  const segments = requestedPath.value
    .split(/[?#]/)[0]!
    .replace(/\.(?:html?|mdx?|php|aspx?)$/i, "")
    .split("/")
    .filter((segment) => segment && !/^(?:index|readme)$/i.test(segment));
  return (segments.at(-1) || "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !/^\d+$/.test(word) && word.length <= 64)
    .slice(0, 8)
    .join(" ");
});
</script>

<template>
  <AppProvider>
    <AppHeader />

    <Main>
      <Container>
        <!-- With suggestions this is a results page, not an error: the missing
             path is one quiet line, the best match leads, and the search field
             at the end carries the guess forward into the palette. -->
        <section v-if="bestMatch" class="mx-auto max-w-2xl pt-12 pb-20 sm:pt-20 sm:pb-28">
          <p class="text-copy-14 text-muted-foreground">
            There's no page at
            <code
              class="bg-muted text-foreground rounded-sm px-1.5 py-0.5 font-mono text-label-12 break-all"
              >{{ requestedPath }}</code
            >
          </p>
          <h1 class="text-heading-24 text-foreground sm:text-heading-32 mt-3">
            {{
              otherMatches.length
                ? "Were you looking for one of these?"
                : "Were you looking for this?"
            }}
          </h1>

          <AppLink
            :to="targetOf(bestMatch)"
            class="group border-border bg-card shadow-small hover:border-brand mt-8 flex items-start gap-4 rounded-lg border p-5 transition-colors"
          >
            <span class="flex min-w-0 flex-1 flex-col gap-1.5">
              <span class="text-label-12 text-brand flex items-center gap-1.5 font-medium">
                <Icon name="i-lucide-sparkles" class="size-3.5" />
                Best match
              </span>
              <span class="text-heading-20 text-foreground group-hover:text-brand">
                {{ bestMatch.title }}
              </span>
              <span
                class="text-label-12 text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
              >
                <template v-if="bestMatch.breadcrumb">
                  <span>{{ crumbOf(bestMatch) }}</span>
                  <span aria-hidden="true">·</span>
                </template>
                <span class="font-mono break-all">{{ decodePath(targetOf(bestMatch)) }}</span>
              </span>
              <span
                v-if="bestMatch.preview"
                class="text-copy-14 text-muted-foreground mt-1 line-clamp-3"
              >
                {{ bestMatch.preview }}
              </span>
            </span>
            <Icon
              name="i-lucide-arrow-right"
              class="text-muted-foreground group-hover:text-brand mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </AppLink>

          <template v-if="otherMatches.length">
            <h2 class="text-heading-14 text-muted-foreground mt-10 mb-3">Other matches</h2>
            <ul class="border-border divide-border divide-y overflow-hidden rounded-lg border">
              <li v-for="item in otherMatches" :key="targetOf(item)">
                <AppLink
                  :to="targetOf(item)"
                  class="group hover:bg-muted/50 flex items-start gap-3 px-4 py-3 transition-colors"
                >
                  <Icon
                    :name="item.hash ? 'i-lucide-hash' : 'i-lucide-file-text'"
                    class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="flex min-w-0 items-baseline justify-between gap-4">
                      <span class="text-copy-14 min-w-0 font-medium">
                        <span v-if="item.breadcrumb" class="text-muted-foreground font-normal"
                          >{{ crumbOf(item) }} ›
                        </span>
                        <span class="text-foreground">{{ item.title }}</span>
                      </span>
                      <span
                        class="text-label-12 text-muted-foreground hidden max-w-[45%] shrink-0 truncate font-mono sm:block"
                      >
                        {{ decodePath(targetOf(item)) }}
                      </span>
                    </span>
                    <span v-if="item.preview" class="text-copy-14 text-muted-foreground truncate">
                      {{ item.preview }}
                    </span>
                    <span class="text-label-12 text-muted-foreground truncate font-mono sm:hidden">
                      {{ decodePath(targetOf(item)) }}
                    </span>
                  </span>
                  <Icon
                    name="i-lucide-arrow-right"
                    class="text-muted-foreground mt-0.5 hidden size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                  />
                </AppLink>
              </li>
            </ul>
          </template>

          <div class="mt-10">
            <p class="text-copy-14 text-muted-foreground mb-3">Not what you were after?</p>
            <DocsSearchField :query="guessQuery" />
            <p class="text-copy-14 text-muted-foreground mt-4">
              Or start over from the
              <AppLink to="/" class="text-foreground underline-offset-4 hover:underline"
                >home page</AppLink
              >.
            </p>
          </div>
        </section>

        <!-- Nothing close, or not a 404 at all: a plain, centred error state. -->
        <section
          v-else
          class="mx-auto flex max-w-md flex-col items-center py-20 text-center sm:py-28"
        >
          <span
            class="bg-muted text-muted-foreground text-label-12 rounded-sm px-1.5 py-0.5 font-mono"
          >
            {{ statusCode }}
          </span>
          <h1 class="text-heading-24 text-foreground sm:text-heading-32 mt-4">
            {{ notFound ? "Page not found" : "Something went wrong" }}
          </h1>
          <p v-if="notFound" class="text-copy-16 text-muted-foreground mt-3">
            Nothing in these docs lives at
            <code
              class="bg-muted text-foreground rounded-sm px-1.5 py-0.5 font-mono text-copy-14 break-all"
              >{{ requestedPath || "this address" }}</code
            >.
          </p>
          <p v-else class="text-copy-16 text-muted-foreground mt-3">{{ message }}</p>

          <DocsSearchField v-if="notFound" class="mt-8" :query="guessQuery" />
          <Button
            to="/"
            :variant="notFound ? 'ghost' : 'solid'"
            :class="notFound ? 'mt-3' : 'mt-8'"
            icon="i-lucide-arrow-left"
          >
            Back home
          </Button>
        </section>
      </Container>
    </Main>

    <AppFooter />

    <ClientOnly>
      <DocsSearch :navigation="docsNavigation" shortcut="meta_k" />
    </ClientOnly>
  </AppProvider>
</template>
