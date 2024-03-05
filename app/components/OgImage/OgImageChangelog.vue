<script setup lang="ts">
// /__og-image__/image/guide/og.png
defineProps<{
  title: string
}>()

const appConfig = useAppConfig()
</script>

<template>
  <!-- Since we use Nuxt UI which replace color by some vars, we need to explicitly set a color. -->
  <div class="w-full h-full flex justify-between relative bg-[#111827] text-white">
    <div class="pt-[80px] px-[60px] pb-[60px] w-full">
      <div class="h-full w-full justify-between relative">
        <div class="w-full flex flex-col items-start">
          <span
            v-if="appConfig.site.name !== title"
            class="mb-6 text-[#f9fafb] text-[24px] px-4 py-2 rounded-full bg-[#F2E78C]/20 border-1 border-[#F2E78C]/70"
          >
            {{ appConfig.site.name }}
          </span>
          <div class="w-full flex flex-row">
            <div>
              <h1 class="my-0 text-[76px] text-white font-bold">
                {{ title }}
              </h1>
            </div>
          </div>
        </div>
        <div class="flex flex-row justify-between">
          <img src="/icon.svg" height="60" width="60" class="rounded-sm h-[60px] w-[60px]" />
          <OrgLogo class="w-6 h-6" />
        </div>
      </div>
    </div>
  </div>
</template>
