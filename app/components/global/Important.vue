<template>
  <Alert title="Important" icon="i-ph-chat-dots-thin" color="violet">
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Alert>
</template>

<script setup lang="ts"></script>
