<script setup lang="ts">
import ColorModeButton from "@app/components/ColorModeButton.vue";
import ThemeColorPicker from "@app/components/ThemeColorPicker.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import LocaleSwitcher from "@app/components/app/LocaleSwitcher.vue";
</script>

<template>
  <div class="hidden items-center gap-1 md:flex">
    <LocaleSwitcher />
    <ThemeColorPicker v-slot="{ accentGlow }" class="-mr-2">
      <ColorModeButton :accent-glow="accentGlow" class="rounded-full" />
    </ThemeColorPicker>
    <SocialButtons size="lg" stacked blog />
  </div>
</template>
