<script setup lang="ts">
/**
 * Мелкая метка «организация» для ООО / ИП в диалогах и админке.
 *
 * Показывается только когда собеседник — бизнес с формой собственности
 * из ORG_LEGAL_FORMS (ooo, ip, odo, zao). Персоны и самозанятые — без бейджа.
 */
withDefaults(defineProps<{ isOrganization?: boolean | null; label?: string }>(), { isOrganization: false, label: 'организация' })
</script>
<template>
  <span
    v-if="isOrganization"
    class="inline-flex items-center gap-0.5 align-middle text-[10px] leading-none font-bold text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/25 rounded-full px-1.5 py-[3px] whitespace-nowrap"
    title="Аккаунт организации"
  >
    <i class="pi pi-building text-[9px]" />
    <span>{{ label }}</span>
  </span>
</template>
