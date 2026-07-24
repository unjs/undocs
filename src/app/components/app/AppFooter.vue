<script setup lang="ts">
import { useAppConfig } from "@app/composables/useAppConfig";
import AppFooterNotes from "@app/components/app/AppFooterNotes.vue";
import AppLink from "@app/components/app/AppLink";
import Container from "@app/components/Container.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
const appConfig = useAppConfig();
</script>

<template>
  <footer class="relative mt-16 border-t border-border">
    <!-- Logo badge centered as a notch on the top border -->
    <AppLink
      :to="`https://github.com/${appConfig.docs.github}`"
      target="_blank"
      :aria-label="`${appConfig.site.name} on GitHub`"
      class="absolute left-1/2 top-0 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background transition-colors hover:border-primary"
    >
      <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="size-7" />
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
