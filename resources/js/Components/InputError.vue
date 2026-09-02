<script setup lang="ts">
defineProps<{ message?: string }>()
</script>
<template>
  <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100">
    <p v-if="message" class="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-3 py-2">
      <span class="shrink-0 w-4 h-4 rounded-full bg-red-600 text-white grid place-items-center text-[10px] leading-none mt-0.5">!</span>
      <span>{{ message }}</span>
    </p>
  </Transition>
</template>
