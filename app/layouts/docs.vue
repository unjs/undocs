<script setup lang="ts"></script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UAside>
          <NavigationTree />
        </UAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
