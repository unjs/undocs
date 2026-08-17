<script setup lang="ts">
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useContributors } from "@app/composables/useContributors.ts";
import Avatar from "@app/components/ui/Avatar.vue";
import Button from "@app/components/ui/Button.vue";
import PageSection from "@app/components/blocks/PageSection.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
const docsConfig = useAppConfig().docs;
// SSR-rendered: `useContributors()` goes through the same-origin
// `/api/docs/contributors` proxy (cached, last-good fallback), so the server can
// fetch it during render and hydrate it into the payload — no client request.
//
// `lazy` for the OTHER path: a client-side navigation to the landing page has no
// payload to seed from, and this is a decorative block sitting inside the page's
// `<Suspense>` — awaiting it there would hold the whole page (hero included)
// behind a proxied GitHub request. Lazy keeps the SSR fetch and lets the client
// fill the section in reactively; it renders nothing until then.
const { data: contributors } = await useAsyncData("contributors", () => useContributors(), {
  lazy: true,
});
</script>

<template>
  <PageSection v-if="contributors?.length" id="contributors" title="Contributors" framed>
    <!-- In the header, outside the frame: the box holds the avatars, nothing
         else. -->
    <template #actions>
      <Button
        v-if="docsConfig.github"
        :to="`https://github.com/${docsConfig.github}`"
        target="_blank"
        color="neutral"
        variant="subtle"
        size="sm"
        icon="i-lucide-git-pull-request"
      >
        Contribute on GitHub
      </Button>
    </template>

    <!-- Desaturated: a wall of avatars is a texture here, and third-party
         artwork is the one colour on the page nothing in the theme aims. -->
    <div class="flex flex-wrap justify-center gap-2">
      <Tooltip v-for="c in contributors" :key="c.username" :text="c.name" :delay-duration="0">
        <a :href="c.profile" target="_blank" class="opacity-80 hover:opacity-100">
          <Avatar :alt="c.name" :src="c.avatar" size="3xl" class="grayscale" />
        </a>
      </Tooltip>
    </div>
  </PageSection>
</template>
