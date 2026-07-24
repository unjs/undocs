<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import { useRoute } from "@app/router";
import { useAsyncData } from "@app/composables/useAsyncData";
import { createError } from "@app/composables/createError";
import { useAppConfig } from "@app/composables/useAppConfig";
import { useHead } from "@unhead/vue";
import { queryPage, hintPrerenderRoute } from "@app/composables/useContent";
import { usePageSEO } from "@app/composables/usePageSEO";
import Breadcrumb from "@app/components/ui/Breadcrumb.vue";
import Button from "@app/components/ui/Button.vue";
import DocsSurround from "@app/components/docs/DocsSurround.vue";
import DocsToc from "@app/components/docs/DocsToc.vue";
import Page from "@app/components/layout/Page.vue";
import PageBody from "@app/components/layout/PageBody.vue";
import PageHeader from "@app/components/layout/PageHeader.vue";
import PageHeaderLinks from "@app/components/layout/PageHeaderLinks.vue";
import PageLinks from "@app/components/layout/PageLinks.vue";
import Separator from "@app/components/ui/Separator.vue";
import MarkdownRenderer from "@app/content/MarkdownRenderer";
import { joinURL } from "ufo";
import { kebabCase } from "scule";
import type { NavItem } from "@server/content/types";

const appConfig = useAppConfig();
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

// Prev/next comes embedded in the page payload (single request per navigation).
const surround = computed(() => page.value?.surround ?? []);

const navigation = inject<Ref<NavItem[]>>("navigation");

// console.log(JSON.stringify(navigation?.value, null, 2))

function makeBreadcrumb(items: NavItem[], path: string, level = 0) {
  const parent = [...items].find((i) => path.startsWith(i.path) && i.children?.length > 0);
  if (!parent) {
    return [];
  }
  if (level === 0) {
    return makeBreadcrumb(parent.children, path, level + 1);
  }
  return [
    {
      label: parent.title,
      icon: parent.icon as string,
      to: parent.page !== false ? parent.path : "",
    },
    ...makeBreadcrumb(parent.children, path, level + 1),
  ];
}

const breadcrumb = computed(() => makeBreadcrumb(navigation?.value || [], page.value.path));

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  description: page.value?.description,
});

const path = computed(() => route.path.replace(/\/$/, ""));
const rawPath = joinURL("/raw", `${path.value}.md`);

// Bake the source markdown (`/raw/<path>.md`, path-based + query-less) alongside
// the page. Hinted via the `x-nitro-prerender` response header — crawlLinks
// can't reach it (it's a `<link rel="alternate">`, not an `<a href>`). No-op
// outside a prerender pass (see `hintPrerenderRoute`).
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
    <PageHeader
      :title="page.title"
      :description="page.description"
      :ui="{
        wrapper: 'flex-row items-center flex-wrap justify-between',
      }"
    >
      <template #headline>
        <Breadcrumb :items="breadcrumb" />
      </template>
      <template #links>
        <Button
          v-for="(link, index) in page.meta?.links || []"
          :key="index"
          size="sm"
          v-bind="link"
        />

        <PageHeaderLinks />
      </template>
    </PageHeader>

    <template v-if="page.body?.toc?.links?.length" #right>
      <DocsToc title="On this page" :links="page.body?.toc?.links || []" highlight />
    </template>

    <PageBody prose class="break-words">
      <MarkdownRenderer v-if="page.body" :value="page" />
    </PageBody>

    <div class="mt-6 space-y-6">
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
      </div>
      <DocsSurround v-if="surround?.length" class="mb-4" :surround="surround" />
    </div>
  </Page>
</template>
