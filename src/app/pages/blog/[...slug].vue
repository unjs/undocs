<script setup lang="ts">
import { useRoute } from "@app/router";
import { useAsyncData } from "@app/composables/useAsyncData";
import { createError } from "@app/composables/createError";
import { useAppConfig } from "@app/composables/useAppConfig";
import { queryPage, hintPrerenderRoute } from "@app/composables/useContent";
import { usePageSEO } from "@app/composables/usePageSEO";
import { useHead } from "@unhead/vue";
import { joinURL } from "ufo";
import Breadcrumb from "@app/components/ui/Breadcrumb.vue";
import Page from "@app/components/layout/Page.vue";
import PageBody from "@app/components/layout/PageBody.vue";
import PageHeader from "@app/components/layout/PageHeader.vue";
import PageLinks from "@app/components/layout/PageLinks.vue";
import Separator from "@app/components/ui/Separator.vue";
import UserCard from "@app/components/UserCard.vue";
import MarkdownRenderer from "@app/content/MarkdownRenderer";
import { kebabCase } from "scule";

const route = useRoute();

const { data: page } = await useAsyncData(kebabCase(route.path), () => queryPage(route.path));

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
    message: `${route.path} does not exist`,
    fatal: true,
  });
}

const appConfig = useAppConfig();

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  description: page.value?.description,
});

const rawPath = joinURL("/raw", `${route.path.replace(/\/$/, "")}.md`);

// Bake the post's source markdown (`/raw/<path>.md`, path-based + query-less)
// alongside its HTML — same as docs pages. Hinted via the `x-nitro-prerender`
// header (crawlLinks can't reach a `<link rel="alternate">`). No-op off a
// prerender pass.
hintPrerenderRoute(rawPath);

useHead({
  link: [
    {
      rel: "alternate",
      href: joinURL(appConfig.site.url, rawPath),
      type: "text/markdown",
    },
  ],
});
</script>

<template>
  <Page v-if="page">
    <PageHeader v-bind="page" :ui="{ headline: 'flex flex-col gap-y-8 items-start' }">
      <template #headline>
        <Breadcrumb
          :items="[
            { label: 'Blog', icon: 'i-lucide-newspaper', to: '/blog' },
            { label: page.title },
          ]"
          class="max-w-full"
        />
        <div class="flex items-center space-x-2">
          <span>
            {{ page.meta.category }}
          </span>
          <span class="text-muted-foreground"
            >&nbsp;&middot;&nbsp;<time>{{ page.meta.date }}</time></span
          >
        </div>
      </template>
      <div class="mt-4 flex flex-wrap items-center gap-6">
        <UserCard
          v-for="(author, index) in page.meta.authors || []"
          :key="index"
          :name="author.name"
          :avatar="{ src: `https://github.com/${author.github}.png?size=64` }"
          :to="`https://github.com/${author.github}`"
          target="_blank"
          :description="author.to ? `@${author.to.split('/').pop()}` : undefined"
        />
      </div>
    </PageHeader>
    <PageBody prose class="break-words">
      <MarkdownRenderer v-if="page.body" :value="page" />
    </PageBody>

    <div class="space-y-6">
      <Separator type="dashed" />
      <div class="mb-4">
        <PageLinks
          class="inline-block"
          :links="[
            {
              icon: 'i-lucide-square-pen',
              label: `Edit this page ${page.automd ? '(some contents are generated with automd from source)' : ''}`,
              to: `https://github.com/${appConfig.docs.github}/edit/${appConfig.docs.branch || 'main'}/docs/${page.id.replace(/^content\//, '')}`,
              target: '_blank',
            },
          ]"
        />
      </div></div
  ></Page>
</template>
