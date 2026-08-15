<script setup lang="ts">
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useSponsors, type Sponsors } from "@app/composables/useSponsors.ts";
import Avatar from "@app/components/ui/Avatar.vue";
import Button from "@app/components/ui/Button.vue";
import PageSection from "@app/components/blocks/PageSection.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
// SSR-rendered: `useSponsors()` goes through the same-origin `/api/docs/sponsors`
// proxy (cached, last-good fallback), so the server can fetch it during render and
// hydrate it into the payload — no client request.
//
// `lazy` so a CLIENT-side navigation to the landing page (no payload to seed
// from) doesn't hold the page's `<Suspense>` — and with it the hero and the
// loading bar — behind a proxied third-party request. See `useAsyncData`.
const { data: sponsors } = await useAsyncData("sponsors", () => useSponsors(), { lazy: true });
</script>

<template>
  <PageSection v-if="sponsors?.sponsors.length" title="Sponsors" framed>
    <!-- In the header, outside the frame: the box holds the sponsors, nothing
         else. -->
    <template #actions>
      <Button
        v-if="sponsors.username"
        icon="i-lucide-heart-handshake"
        :to="`https://github.com/sponsors/${sponsors.username}`"
        target="_blank"
        color="neutral"
        variant="subtle"
        size="sm"
      >
        Become a Sponsor
      </Button>
    </template>

    <div id="sponsors" class="flex flex-col items-center gap-8">
      <div
        v-for="(tier, i) of sponsors.sponsors.slice(0, 2)"
        :key="i"
        class="flex flex-wrap justify-center gap-8 max-w-4xl"
      >
        <div v-for="s in tier" :key="s.name" class="flex items-center gap-6 max-w-[300px]">
          <a
            :href="s.website"
            target="_blank"
            class="flex items-center gap-2 opacity-80 hover:opacity-100"
            :class="`font-size-${i === 0 ? '3xl' : i === 1 ? 'xl' : 'lg'}`"
          >
            <img
              v-if="s.image"
              :src="s.image"
              :alt="s.name"
              class="object-contain rounded-lg"
              :style="{
                width: i === 0 ? '80px' : '48px',
                height: i === 0 ? '80px' : '48px',
              }"
            />
            <span v-if="i < 2" class="font-semibold" :class="`text-${i === 0 ? '2xl' : 'xl'}`">{{
              s.name
            }}</span>
          </a>
        </div>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <Tooltip v-for="s in sponsors.sponsors[2]" :key="s.name" :text="s.name" :delay-duration="0">
          <a :href="s.website" target="_blank" class="opacity-80 hover:opacity-100">
            <Avatar :alt="s.name" :src="s.image" size="2xl" />
          </a>
        </Tooltip>
      </div>
      <div class="flex flex-wrap justify-center gap-1">
        <Tooltip v-for="s in sponsors.sponsors[3]" :key="s.name" :text="s.name" :delay-duration="0">
          <a :href="s.website" target="_blank" class="opacity-80 hover:opacity-100">
            <Avatar :alt="s.name" :src="s.image" />
          </a>
        </Tooltip>
      </div>
    </div>
  </PageSection>
</template>
