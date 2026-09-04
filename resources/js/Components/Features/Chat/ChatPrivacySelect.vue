<script setup lang="ts">
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import { PRIVACY_OPTIONS, isRandomDisabledFor } from '@/composables/usePrivacySettings'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const props = defineProps<{ privacy: { message_privacy: string; allow_random_messages: boolean } }>()
const emit = defineEmits<{ (e: 'savePrivacy'): void }>()
const { selectPt } = useDropdownMenuStyle()

function onPrivacyChange(v: any) {
  props.privacy.message_privacy = v
  emit('savePrivacy')
}

function onRandomChange(v: any) {
  props.privacy.allow_random_messages = !!v
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
    <label
      class="flex items-center gap-2.5 text-xs p-3 lg:p-2 rounded-xl border bg-white dark:bg-zinc-900 dark:text-zinc-200 border-stone-200 dark:border-zinc-700"
      :class="isRandomDisabledFor(privacy.message_privacy) ? 'opacity-60' : ''"
    >
      <Checkbox :modelValue="privacy.allow_random_messages" @update:modelValue="onRandomChange" :disabled="isRandomDisabledFor(privacy.message_privacy)" binary inputId="allow-random" />
      <span class="text-[13px] lg:text-xs select-none">Разрешить рандомным писать</span>
    </label>
  </div>
</template>
