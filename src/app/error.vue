<script setup lang="ts">
import { computed, provide } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData";
import { useHead, useSeoMeta } from "@unhead/vue";
import { queryNavigation } from "@app/composables/useContent";
import AppFooter from "@app/components/app/AppFooter.vue";
import AppHeader from "@app/components/app/AppHeader.vue";
import AppProvider from "@app/components/ui/AppProvider.vue";
import Button from "@app/components/ui/Button.vue";
import Container from "@app/components/Container.vue";
import Main from "@app/components/layout/Main.vue";
import Page from "@app/components/layout/Page.vue";
import DocsSearch from "@app/components/docs/DocsSearch.vue";
import ClientOnly from "@app/components/app/ClientOnly";
import type { AppError } from "@app/composables/createError";

useSeoMeta({
  title: "Page not found",
  description: "We are sorry but this page could not be found.",
});

const props = defineProps<{
  error: AppError;
}>();

useHead({
  htmlAttrs: {
    lang: "en",
  },
});

const { data: navigation } = await useAsyncData("navigation", () => queryNavigation());

provide("navigation", navigation);

const statusCode = computed(() => props.error?.statusCode || 404);
const message = computed(
  () => props.error?.message || props.error?.statusMessage || "This page could not be found.",
);
</script>

<template>
  <AppProvider>
    <AppHeader />

    <Main>
      <Container>
        <Page>
          <div class="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <p class="text-primary text-base font-semibold">{{ statusCode }}</p>
            <h1 class="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              {{ statusCode === 404 ? "Page not found" : "An error occurred" }}
            </h1>
            <p class="text-muted-foreground max-w-md text-base">{{ message }}</p>
            <Button to="/" size="lg" class="mt-2">Back home</Button>
          </div>
        </Page>
      </Container>
    </Main>

    <AppFooter />

    <ClientOnly>
      <DocsSearch :navigation="navigation" shortcut="meta_k" />
    </ClientOnly>
  </AppProvider>
</template>
