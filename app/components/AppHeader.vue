<script setup lang="ts">
const appConfig = useAppConfig()
const docsNav = useDocsNav()

const navigation = inject('navigation')

const headerLinks = computed(() => {
  return [
    ...docsNav.links
      .filter((link) => link.hasIndex)
      .map((link) => {
        return {
          ...link,
          children: undefined,
          icon: '',
          // children: link.children?.filter((child) => !child.children || child.children.some((c) => c.to === child.to)),
        }
      }),
  ]
})
</script>

<template>
  <UHeader to="/">
    <template #title>
      <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
      <span>
        {{ appConfig.site.name }}
      </span>
    </template>

    <UNavigationMenu v-if="headerLinks.length > 1" :items="headerLinks" variant="link" />

    <template #right>
      <UTooltip text="Search" :kbds="['meta', 'K']">
        <UContentSearchButton />
      </UTooltip>
      <!-- <div class="flex items-center border-l border-slate-200 ml-6 pl-6 dark:border-slate-800"> -->
      <UColorModeButton />
      <SocialButtons />
    </template>

    <template #body>
      <UContentNavigation :navigation="navigation" default-open :multiple="true" />
    </template>
  </UHeader>
</template>
