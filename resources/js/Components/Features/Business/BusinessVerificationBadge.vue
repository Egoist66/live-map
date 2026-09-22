<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

const props = defineProps<{ status: BusinessVerificationStatus }>()

const meta = computed(() => {
  if (props.status === 'verified') {
    return { label: 'Проверено', icon: 'pi pi-verified', cls: '!bg-emerald-500 !border-0' }
  }
  if (props.status === 'pending') {
    return { label: 'На проверке', icon: 'pi pi-clock', cls: '!bg-amber-500 !border-0' }
  }
  if (props.status === 'rejected') {
    return { label: 'Отклонено', icon: 'pi pi-times-circle', cls: '!bg-red-500 !border-0' }
  }
  return { label: 'Черновик', icon: 'pi pi-pencil', cls: '!bg-zinc-500 !border-0' }
})
</script>

<template>
  <Tag :class="['!text-white !rounded-full !px-3 !py-1.5 !text-xs !font-bold', meta.cls]">
    <i :class="[meta.icon, 'mr-1.5 text-xs']" />{{ meta.label }}
  </Tag>
</template>
