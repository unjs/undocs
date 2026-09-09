<script lang="ts" setup>
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import AppLink from "@app/components/app/AppLink.ts";
const appConfig = useAppConfig();
</script>

<template>
  <div class="flex flex-col gap-1 text-center text-sm text-muted-foreground sm:text-left">
    <template v-if="appConfig.docs.footer?.notes?.length">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-for="(note, i) in appConfig.docs.footer.notes"
        :key="i"
        class="[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-brand"
        v-html="note"
      />
    </template>

    <p v-else>
      <span class="text-foreground font-medium">
        <AppLink
          class="text-foreground hover:text-brand"
          :to="`https://github.com/${appConfig.docs.github}`"
          target="_blank"
          >{{ appConfig.site.name }}
        </AppLink>
      </span>
      <template v-if="appConfig.docs.shortDescription">
        &nbsp;<span class="text-muted-foreground">{{
          appConfig.docs.shortDescription.replace(/\.$/, "")
        }}</span
        >.
      </template>
    </p>
  </div>
</template>
