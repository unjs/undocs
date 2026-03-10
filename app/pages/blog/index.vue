<script setup lang="ts">
const { data: page } = await useAsyncData("/blog", () =>
  queryCollection("content").path("/blog").first(),
);

const { data: articles } = await useAsyncData(() =>
  queryCollection("content")
    .where("path", "LIKE", "/blog/%")
    .order("id", "DESC")
    .all()
    .then((res) => res),
);

const appConfig = useAppConfig();

if (page.value) {
  usePageSEO({
    title: `${page.value.title} - ${appConfig.site.name}`,
    ogTitle: page.value.title,
    description: page.value.description,
  });
}
</script>

<template>
  <UContainer v-if="page">
    <UPageHero :title="page.title" orientation="horizontal">
      <template #description>{{ page.description }}</template>
    </UPageHero>

    <UPageBody>
      <UContainer>
        <UBlogPosts class="mb-12 md:grid-cols-2 lg:grid-cols-3">
          <UBlogPost
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
            :orientation2="index === 0 ? 'horizontal' : 'vertical'"
            :class="[index === 0 && 'col-span-full']"
          />
        </UBlogPosts>
      </UContainer>
    </UPageBody>
  </UContainer>

  <UContainer v-else>
    <UPageHero
      title="Blog"
      description="No blog articles yet. Check back soon!"
      orientation="horizontal"
    />
  </UContainer>
</template>
