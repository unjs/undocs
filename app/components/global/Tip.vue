<template>
  <Alert title="Tip" icon="i-ph-lightbulb-light" color="green">
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Alert>
</template>

<script setup lang="ts"></script>
