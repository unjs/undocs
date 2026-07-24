<script setup lang="ts">
import { useAsyncData } from "@app/composables/useAsyncData";
import { useAppConfig } from "@app/composables/useAppConfig";
import { useContributors } from "@app/composables/useContributors";
import Avatar from "@app/components/ui/Avatar.vue";
import Button from "@app/components/ui/Button.vue";
import PageSection from "@app/components/blocks/PageSection.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
const docsConfig = useAppConfig().docs;
// SSR-rendered: `useContributors()` goes through the same-origin
// `/api/docs/contributors` proxy (cached, last-good fallback), so the server can
// fetch it during render and hydrate it into the payload — no client request.
const { data: contributors } = await useAsyncData(() => useContributors());
</script>

<template>
  <PageSection v-if="contributors?.length" id="contributors" title="Contributors" aura>
    <div class="flex flex-wrap justify-center gap-2">
      <Tooltip v-for="c in contributors" :key="c.username" :text="c.name" :delay-duration="0">
        <a :href="c.profile" target="_blank" class="opacity-80 hover:opacity-100">
          <Avatar :alt="c.name" :src="c.avatar" size="3xl" />
        </a>
      </Tooltip>
    </div>
    <div class="text-center mt-8">
      <Button
        v-if="docsConfig.github"
        :to="`https://github.com/${docsConfig.github}`"
        target="_blank"
        color="neutral"
        icon="i-lucide-git-pull-request"
      >
        Contribute on GitHub
      </Button>
    </div>
  </PageSection>
</template>
