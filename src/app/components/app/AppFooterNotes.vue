<script lang="ts" setup>
import { useAppConfig } from "@app/composables/useAppConfig";
import AppLink from "@app/components/app/AppLink";
const appConfig = useAppConfig();
</script>

<template>
  <p class="text-sm text-muted-foreground">
    <span class="text-foreground font-medium">
      <AppLink
        class="text-foreground hover:text-primary"
        :to="`https://github.com/${appConfig.docs.github}`"
        target="_blank"
        >{{ appConfig.site.name }}
      </AppLink>
    </span>
    &nbsp;<span class="text-muted-foreground">{{
      appConfig.docs.shortDescription.replace(/\.$/, "")
    }}</span
    >.
  </p>
</template>
