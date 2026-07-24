<script setup lang="ts">
import Container from "@app/components/Container.vue";
import Page from "@app/components/layout/Page.vue";
</script>

<template>
  <Container>
    <Page>
      <slot />
    </Page>
  </Container>
</template>
