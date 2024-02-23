import type { NavItem } from '@nuxt/content/dist/runtime/types'

export function useDocsNav() {
  const navigation = inject<Ref<NavItem[]>>('navigation')

  const route = useRoute()

  const isActive = (path: string) => route.path.startsWith(path)

  const links = computed(() => {
    return mapContentNavigation(navigation.value).map((item) => {
      if (item.children?.length === 1) {
        return {
          ...item,
          ...item.children[0],
          children: undefined,
          active: isActive(item.to as string),
        }
      }
      return {
        ...item,
        label: titleCase(item.to),
        active: isActive(item.to as string),
      }
    })
  })

  const activeLinks = computed(() => {
    return links.value.find((l) => route.path.startsWith(l.to as string))?.children || []
  })

  return reactive({
    links,
    activeLinks,
  })
}
