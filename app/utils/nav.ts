import type { NavItem } from '@nuxt/content/dist/runtime/types'

export function useDocsNav() {
  const navigation = inject<Ref<NavItem[]>>('navigation')

  const route = useRoute()

  const isActive = (path: string) => route.path.startsWith(path)

  const links = computed(() => {
    return mapContentNavigation(navigation.value).map((item) => {
      // Flatren single child
      if (item.children?.length === 1) {
        item = {
          ...item,
          ...item.children[0],
          children: undefined,
        }
      }

      // Check if group index is not exists and default to first child
      const originalTo = item.to as string
      if (item.children?.length && !item.children.some((c) => c.to === originalTo)) {
        item.to = item.children[0].to
      }

      return {
        ...item,
        originalTo,
        hasIndex: item.to === originalTo,
        label: titleCase(originalTo),
        active: isActive(originalTo),
      }
    })
  })

  const activeSection = computed(() => links.value.find((l) => route.path.startsWith(l.originalTo)))
  const activeLinks = computed(() => (activeSection.value?.children || []).filter(Boolean))

  return reactive({
    links,
    activeSection,
    activeLinks,
  })
}
