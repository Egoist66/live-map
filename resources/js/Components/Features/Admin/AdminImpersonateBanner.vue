<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{ imp: any; userName?: string }>()
</script>
<template>
  <div v-if="imp.isImpersonating.value" class="bg-red-600 text-white px-3 sm:px-6 py-2 flex items-center gap-2.5 text-[13px] font-semibold sticky top-[64px] z-40">
    <i class="pi pi-eye shrink-0" />
    <span class="truncate flex-1">Вы просматриваете аккаунт <b>{{ userName }}</b>. Действия фиксируются в журнале.</span>
    <Button label="Вернуться" size="small" rounded :loading="imp.stopping.value" class="!bg-white !text-red-700 !border-0 !text-xs !font-bold shrink-0" @click="imp.stop()" />
  </div>
</template>
