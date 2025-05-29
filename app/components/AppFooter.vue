<template>
  <USeparator class="-mb-[10px]">
    <!-- <OrgLogo class="w-5 h-5 z-10" /> -->
    <img :src="useAppConfig().docs.logo" class="w-10 h-10" />
  </USeparator>
  <UFooter>
    <template #left>
      <AppFooterNotes />
    </template>

    <template #right>
      <SocialButtons />
    </template>
  </UFooter>
</template>
