<script setup lang="ts">
import { computed, watch } from "vue";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useLocaleDocsConfig } from "@app/composables/useLocaleDocsConfig.ts";
import { useI18nDisableMeta } from "@app/composables/useI18nDisableMeta.ts";
import { queryBlog, queryPage } from "@app/composables/useContent.ts";
import { usePageSEO } from "@app/composables/usePageSEO.ts";
import { useUndocsT } from "@app/composables/useUndocsT.ts";
import { useRoute } from "@app/router.ts";
import { getLocaleFromPath, resolveI18nConfig } from "@app/utils/locale.ts";
import BlogPost from "@app/components/blog/BlogPost.vue";
import BlogPosts from "@app/components/blog/BlogPosts.vue";
import Container from "@app/components/Container.vue";
import PageBody from "@app/components/layout/PageBody.vue";
import PageHero from "@app/components/blocks/PageHero.vue";

const route = useRoute();
const appConfig = useAppConfig();
const localeDocs = useLocaleDocsConfig();
const disableMetaRef = useI18nDisableMeta();
const { t } = useUndocsT();
const i18nConfig = resolveI18nConfig(appConfig.docs as { lang?: string; i18n?: any });
const locale = computed(() =>
  getLocaleFromPath(
    route.path,
    i18nConfig.localeCodes,
    i18nConfig.defaultLocale,
    i18nConfig.strategy,
  ),
);

const { data: page } = await useAsyncData(`blog-index:${route.path}`, () => queryPage(route.path));

const { data: articles } = await useAsyncData(`blog-articles:${locale.value}`, async () => {
  const all = await queryBlog();
  return all.filter((article) => {
    const articleLocale = getLocaleFromPath(
      article.path,
      i18nConfig.localeCodes,
      i18nConfig.defaultLocale,
      i18nConfig.strategy,
    );
    return articleLocale === locale.value;
  });
});

watch(
  () => Boolean((page.value?.meta as any)?.i18n?.disableMeta),
  (v) => {
    disableMetaRef.value = v;
  },
  { immediate: true },
);

if (page.value) {
  usePageSEO({
    title: `${page.value.title} - ${localeDocs.value.name || appConfig.site.name}`,
    description: page.value.description || localeDocs.value.description || "",
  });
}
</script>

<template>
  <Container v-if="page">
    <PageHero :title="page.title" orientation="horizontal">
      <template #description>{{ page.description }}</template>
    </PageHero>

    <PageBody>
      <Container>
        <BlogPosts class="mb-12 md:grid-cols-2 lg:grid-cols-3">
          <BlogPost
            v-for="(article, index) in articles"
            :key="article.path"
            :to="article.path"
            :title="article.title"
            :description="article.description"
            :date="article.meta?.date"
            :badge="
              article.meta?.category
                ? { label: article.meta.category, color: 'primary', variant: 'subtle' }
                : undefined
            "
            :variant="index > 0 ? 'outline' : 'subtle'"
            :orientation="index === 0 ? 'horizontal' : 'vertical'"
            :class="[index === 0 && 'col-span-full']"
          />
        </BlogPosts>
      </Container>
    </PageBody>
  </Container>

  <Container v-else>
    <PageHero :title="t('blog.title')" :description="t('blog.empty')" orientation="horizontal" />
  </Container>
</template>
