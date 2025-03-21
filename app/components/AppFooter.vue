<template>
  <USeparator class="-mb-[10px]">
    <OrgLogo class="w-5 h-5 z-10" />
  </USeparator>
  <UFooter :links="[]" class="bg-background/75 backdrop-blur">
    <template #left>
      <AppFooterNotes />
    </template>

    <template #right>
      <ColorPicker />
      <SocialButtons />
    </template>
  </UFooter>
</template>
