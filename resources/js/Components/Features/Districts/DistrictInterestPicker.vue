<script setup lang="ts">
import Button from 'primevue/button'
import { DISTRICT_INTEREST_OPTIONS } from '@/utils/districtGeo'

defineProps<{
  selected: string
}>()

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

/**
 * Стиль кнопки интереса: выбранная — синяя, остальные — нейтральные.
 *
 * @param isActive выбран ли интерес
 */
function optionClass(isActive: boolean): string {
  if (isActive) {
    return '!bg-blue-600 !border-blue-600 !text-white'
  }
  return '!bg-stone-100 dark:!bg-white/10 !text-stone-600 dark:!text-zinc-200 !border-stone-200 dark:!border-white/10'
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <Button
      v-for="option in DISTRICT_INTEREST_OPTIONS"
      :key="option.v"
      :label="`${option.i} ${option.l}`"
      rounded
      outlined
      size="small"
      :class="['!text-xs !font-bold active:scale-95 transition', optionClass(selected === option.v)]"
      @click="emit('select', option.v)"
    />
  </div>
</template>
