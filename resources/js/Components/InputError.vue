<script setup lang="ts">
import Message from 'primevue/message'
defineProps<{ message?: string }>()
</script>
<template>
  <Message v-if="message" severity="error" :closable="false" class="mt-1.5 !rounded-xl !text-[13px] !py-2 !px-3 justify-start">{{ message }}</Message>
</template>
