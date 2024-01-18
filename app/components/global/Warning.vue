<template>
  <Alert title="Warning" icon="i-ph-warning" color="yellow">
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Alert>
</template>

<script setup lang="ts"></script>
