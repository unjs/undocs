import type { ContentNavigationItem } from '@nuxt/content'

export function useDocsNav() {
  const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')
  const route = useRoute()
  const isActive = (path: string) => route.path.startsWith(path)

  const links = computed(() => {
    return navigation.value.map((item) => {
      console.log(item)
      // Flaten single child
      if (item.children?.length === 1) {
        item = {
          ...item,
          ...item.children[0],
          children: undefined,
        }
      }

      // Check if group index is not exists and default to first child
      const originalPath = item.path
      if (item.children?.length && !item.children.some((c) => c.path === originalPath)) {
        item.path = item.children[0].path
      }

      return {
        ...item,
        to: item.path,
        originalPath,
        hasIndex: item.path === originalPath,
        label: titleCase(originalPath),
        active: isActive(originalPath),
      }
    })
  })

  const activeSection = computed(() => links.value.find((l) => route.path.startsWith(l.originalPath)))
  const activeLinks = computed(() => (activeSection.value?.children || []).filter(Boolean))

  return reactive({
    links,
    activeSection,
    activeLinks,
  })
}
