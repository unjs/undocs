<script setup lang="ts">
import { useAsyncData } from "@app/composables/useAsyncData";
import { useAppConfig } from "@app/composables/useAppConfig";
import { queryBlog, queryPage } from "@app/composables/useContent";
import { usePageSEO } from "@app/composables/usePageSEO";
import BlogPost from "@app/components/blog/BlogPost.vue";
import BlogPosts from "@app/components/blog/BlogPosts.vue";
import Container from "@app/components/Container.vue";
import PageBody from "@app/components/layout/PageBody.vue";
import PageHero from "@app/components/blocks/PageHero.vue";
const { data: page } = await useAsyncData("/blog", () => queryPage("/blog"));

const { data: articles } = await useAsyncData("blog-articles", () => queryBlog());

const appConfig = useAppConfig();

if (page.value) {
  usePageSEO({
    title: `${page.value.title} - ${appConfig.site.name}`,
    description: page.value.description,
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
    <PageHero
      title="Blog"
      description="No blog articles yet. Check back soon!"
      orientation="horizontal"
    />
  </Container>
</template>
