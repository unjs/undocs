<template>
  <Alert title="Caution" icon="i-ph-info-bold" color="red">
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Alert>
</template>

<script setup lang="ts"></script>
