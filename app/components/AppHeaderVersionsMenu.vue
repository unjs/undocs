<script setup lang="ts">
const appConfig = useAppConfig()

const items = computed(() => {
  return appConfig.docs.versions.map((version) => {
    return {
      label: version.label,
      to: version.to,
      active: version.active,
      type: 'checkbox' as const,
      color: 'primary' as const,
      checked: version.active,
    }
  })
})
const activeVersion = computed(() => {
  return appConfig.docs.versions.find((version) => version.active) || appConfig.docs.versions[0]
})
</script>

<template>
  <UDropdownMenu
    v-slot="{ open }"
    :modal="false"
    :items="items"
    :content="{ align: 'start' }"
    :ui="{ content: 'min-w-fit' }"
    size="xs"
    class="ml-1"
  >
    <UButton
      :label="activeVersion?.label"
      variant="subtle"
      trailing-icon="i-lucide-chevron-down"
      size="xs"
      class="-mb-[6px] font-semibold rounded-full truncate"
      :class="[open && 'bg-primary/15']"
      :ui="{
        trailingIcon: ['transition-transform duration-200', open ? 'rotate-180' : undefined].filter(Boolean).join(' ')
      }"
    />
  </UDropdownMenu>
</template>
