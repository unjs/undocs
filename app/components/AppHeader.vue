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

const mobileLinks = computed(() => {
  return navigation.value.map((item) => {
    if (item.path === '/blog') {
      return {
        ...item,
        children: undefined,
      }
    }
    if (item.children?.length === 1) {
      return item.children[0]
    }
    const originalPath = item.path
    if (item.children?.length && item.children.some((c) => c.path === originalPath)) {
      item.title = titleCase(originalPath)
    }
    return item
  })
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
      <UColorModeButton />
      <SocialButtons />
    </template>

    <template #body>
      <UContentNavigation :navigation="mobileLinks" default-open :multiple="true" />
    </template>
  </UHeader>
</template>
