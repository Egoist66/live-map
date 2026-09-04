<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ status: string; isOwn?: boolean }>()
const isRead = computed(() => props.status === 'read')
const isDelivered = computed(() => props.status === 'delivered')
const isSent = computed(() => props.status === 'sent')
const isSending = computed(() => props.status === 'sending')
const isFailed = computed(() => props.status === 'failed')
</script>
<template>
  <span class="inline-flex items-center shrink-0" :title="status">
    <span v-if="isSending" class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-60"></span>
    <span v-else-if="isFailed" class="text-[11px] text-red-400">✕</span>
    <span v-else-if="isRead" class="text-[11px] font-bold text-sky-400 leading-none">✓✓</span>
    <span v-else-if="isDelivered" class="text-[11px] font-bold opacity-60 leading-none">✓✓</span>
    <span v-else-if="isSent" class="text-[11px] font-bold opacity-60 leading-none">✓</span>
  </span>
</template>
