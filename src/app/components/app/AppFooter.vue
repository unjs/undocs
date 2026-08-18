<script setup lang="ts">
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import AppFooterNotes from "@app/components/app/AppFooterNotes.vue";
import AppLink from "@app/components/app/AppLink.ts";
import Container from "@app/components/Container.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import AppLogo from "@app/components/app/AppLogo.vue";
const appConfig = useAppConfig();
</script>

<template>
  <footer class="relative mt-16 border-t border-border">
    <!-- The badge exists to hang the logo over the footer rule; with no logo
         there is nothing to hang, so it goes rather than leaving an empty
         circle (the GitHub link is still in `SocialButtons` below). -->
    <AppLink
      v-if="appConfig.docs.logo"
      :to="`https://github.com/${appConfig.docs.github}`"
      target="_blank"
      :aria-label="`${appConfig.site.name} on GitHub`"
      class="absolute left-1/2 top-0 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background transition-colors hover:border-brand"
    >
      <AppLogo class="size-7 grayscale" />
    </AppLink>

    <Container>
      <div
        class="flex flex-col items-center gap-4 pb-8 pt-12 text-sm text-muted-foreground sm:flex-row sm:justify-between"
      >
        <AppFooterNotes />
        <div class="flex items-center gap-1">
          <SocialButtons />
        </div>
      </div>
    </Container>
  </footer>
</template>
