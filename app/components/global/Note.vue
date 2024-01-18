<template>
  <Alert title="Note" icon="i-ph-info-light" color="blue">
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Alert>
</template>

<script setup lang="ts"></script>
