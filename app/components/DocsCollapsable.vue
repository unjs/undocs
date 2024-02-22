<template>
  <Disclosure v-slot="{ open }">
    <DisclosureButton :class="ui.button.base">
      <UIcon
        :name="ui.button.icon.name"
        :class="[ui.button.icon.base, open ? ui.button.icon.active : ui.button.icon.inactive]"
      />
      <span>{{ name }}</span>
    </DisclosureButton>

    <DisclosurePanel :class="ui.panel">
      <ContentSlot unwrap="p" :use="$slots.default" />
    </DisclosurePanel>
  </Disclosure>
</template>

<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'

const appConfig = useAppConfig()

const config = computed(() => ({
  button: {
    base: 'flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
    icon: {
      name: appConfig.ui.icons.chevron,
      base: 'w-4 h-4 transform transition-transform duration-200',
      active: '',
      inactive: '-rotate-90',
    },
  },
  panel: 'mt-4 ml-2 py-2.5 pl-4 border-l border-gray-200 dark:border-gray-800 [&>div]:!mt-0',
}))

defineProps({
  name: {
    type: String,
    default: 'properties',
  },
})

const { ui } = useUI('prose.collapsible', undefined, config, undefined, true)
</script>
