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
import Container from "@app/components/Container.vue";
import Main from "@app/components/layout/Main.vue";
import Page from "@app/components/layout/Page.vue";
import DocsSearch from "@app/components/docs/DocsSearch.vue";
import ClientOnly from "@app/components/app/ClientOnly.ts";
import AppLink from "@app/components/app/AppLink.ts";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import type { AppError } from "@app/composables/createError.ts";
import type { NotFoundData } from "@app/composables/useContent.ts";

useSeoMeta({
  title: "Page not found",
  description: "We are sorry but this page could not be found.",
});

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
const message = computed(
  () => props.error?.message || props.error?.statusMessage || "This page could not be found.",
);

// A 404 the server could not resolve to one page still knows the near misses
// (`pageNotFound`), so the page becomes a results list — plain links, which is
// also what an agent reading the HTML gets to follow.
const suggestions = computed(() =>
  statusCode.value === 404 ? (props.error?.data?.suggestions ?? []) : [],
);

const { open: searchOpen } = useDocsSearch();
</script>

<template>
  <AppProvider>
    <AppHeader />

    <Main>
      <Container>
        <Page>
          <div
            class="flex flex-col items-center justify-center gap-4 text-center"
            :class="suggestions.length ? 'pt-24 pb-10' : 'py-24'"
          >
            <p class="text-brand text-base font-semibold">{{ statusCode }}</p>
            <h1 class="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              {{ statusCode === 404 ? "Page not found" : "An error occurred" }}
            </h1>
            <p class="text-muted-foreground max-w-md text-base">{{ message }}</p>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
              <Button to="/" size="lg">Back home</Button>
              <Button
                v-if="statusCode === 404"
                size="lg"
                variant="outline"
                icon="i-lucide-search"
                @click="searchOpen = true"
              >
                Search docs
              </Button>
            </div>
          </div>

          <section v-if="suggestions.length" class="mx-auto max-w-2xl pb-24">
            <h2 class="text-muted-foreground mb-3 text-sm font-medium">Were you looking for</h2>
            <ul class="flex flex-col gap-2">
              <li v-for="item in suggestions" :key="item.path + (item.hash || '')">
                <AppLink
                  :to="item.path + (item.hash || '')"
                  class="group border-border hover:border-brand flex flex-col gap-1 rounded-lg border p-4 transition-colors"
                >
                  <span class="text-muted-foreground text-xs">
                    {{ item.breadcrumb ? `${item.breadcrumb} · ` : "" }}{{ item.path }}
                  </span>
                  <span class="text-foreground group-hover:text-brand font-medium">
                    {{ item.title }}
                  </span>
                  <span v-if="item.preview" class="text-muted-foreground line-clamp-2 text-sm">
                    {{ item.preview }}
                  </span>
                </AppLink>
              </li>
            </ul>
          </section>
        </Page>
      </Container>
    </Main>

    <AppFooter />

    <ClientOnly>
      <DocsSearch :navigation="docsNavigation" shortcut="meta_k" />
    </ClientOnly>
  </AppProvider>
</template>
