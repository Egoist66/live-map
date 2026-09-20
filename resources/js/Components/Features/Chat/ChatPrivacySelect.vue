<script setup lang="ts">
import Select from 'primevue/select'
import { PRIVACY_OPTIONS } from '@/composables/usePrivacySettings'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const props = defineProps<{ privacy: { message_privacy: string } }>()
const emit = defineEmits<{ (e: 'savePrivacy'): void }>()
const { selectPt } = useDropdownMenuStyle()

function onPrivacyChange(v: any) {
  props.privacy.message_privacy = v
  emit('savePrivacy')
}
</script>
<template>
  <div class="space-y-2 min-w-0">
    <Select
      :modelValue="privacy.message_privacy"
      @update:modelValue="onPrivacyChange"
      :options="PRIVACY_OPTIONS"
      optionLabel="label"
      optionValue="value"
      placeholder="Кто может писать"
      checkmark
      scrollHeight="12rem"
      fluid
      class="w-full min-w-0 !rounded-xl"
      :pt="selectPt"
    >
      <template #value="p">
        <span v-if="p.value" class="flex items-center gap-2 text-sm text-stone-900 dark:text-zinc-100 truncate">
          <i :class="(PRIVACY_OPTIONS.find((o) => o.value === p.value)?.icon ?? 'pi pi-lock') + ' text-xs text-violet-600 dark:text-violet-400 shrink-0'"></i>
          <span class="truncate">{{ PRIVACY_OPTIONS.find((o) => o.value === p.value)?.label }}</span>
        </span>
        <span v-else class="text-sm text-stone-400 dark:text-zinc-500">Кто может писать</span>
      </template>
      <template #option="p">
        <span class="flex items-center gap-2 text-sm truncate">
          <i :class="p.option.icon + ' text-xs opacity-60 shrink-0'"></i>
          <span class="truncate">{{ p.option.label }}</span>
        </span>
      </template>
    </Select>
  </div>
</template>
