<script lang="ts" setup>
import { AppFooterNotes } from '#components'
</script>

<template>
  <div class="w-full h-px bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
    <div class="bg-white dark:bg-gray-900 px-4">
      <OrgLogo class="w-5 h-5" />
    </div>
  </div>
  <UFooter :links="[]">
    <template #left>
      <AppFooterNotes />
    </template>

    <template #right>
      <ColorPicker />
      <SocialButtons />
    </template>
  </UFooter>
</template>
