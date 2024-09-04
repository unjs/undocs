<script setup lang="ts">
const slots = useSlots()
const steps = computed(() => {
  const s = slots.default?.() || []

  return s.map((step, index) => {
    return {
      idx: index + 1,
      component: step,
    }
  })
})

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <div role="list" class="ml-3.5 mt-10 mb-6">
    <div v-for="(step, idx) in steps" :key="step.idx" role="listitem" class="relative flex items-start pb-2">
      <div
        class="absolute w-px h-[calc(100%-2.5rem)] top-[2.75rem] bg-gray-200/70 dark:bg-white/10"
        :class="{
          hidden: idx === steps.length - 1,
        }"
      />
      <div class="absolute ml-[-14px] py-2">
        <UBadge variant="soft" size="lg" color="gray">
          {{ step.idx }}
        </UBadge>
      </div>

      <div class="w-full overflow-hidden pl-8 md:pl-12 pr-px">
        <component :is="step.component" class="mt-2.5" />
      </div>
    </div>
  </div>
</template>
