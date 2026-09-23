<script setup lang="ts">
import { toRef } from 'vue'
import Select from 'primevue/select'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useChatPrivacy, type ChatPrivacyState } from '@/composables/useChatPrivacy'

const props = withDefaults(defineProps<{ privacy: ChatPrivacyState; uloveOnly?: boolean }>(), { uloveOnly: false })
const emit = defineEmits<{ (e: 'savePrivacy'): void }>()
const { selectPt } = useDropdownMenuStyle()
const chatPrivacy = useChatPrivacy(toRef(props, 'privacy') as any, toRef(props, 'uloveOnly'))

function onPrivacyChange(v: any) {
  chatPrivacy.applyValue(String(v))
  emit('savePrivacy')
}
</script>
<template>
  <div class="space-y-2 min-w-0">
    <Select
      :modelValue="chatPrivacy.currentValue.value"
      @update:modelValue="onPrivacyChange"
      :options="chatPrivacy.options.value"
      optionLabel="label"
      optionValue="value"
      :placeholder="uloveOnly ? 'Кто может писать в ULove' : 'Кто может писать'"
      checkmark
      scrollHeight="12rem"
      fluid
      class="w-full min-w-0 !rounded-xl"
      :pt="selectPt"
    >
      <template #value="p">
        <span v-if="p.value" class="flex items-center gap-2 text-sm text-stone-900 dark:text-zinc-100 truncate">
          <i :class="(chatPrivacy.options.value.find((o) => o.value === p.value)?.icon ?? 'pi pi-lock') + ' text-xs text-violet-600 dark:text-violet-400 shrink-0'"></i>
          <span class="truncate">{{ chatPrivacy.options.value.find((o) => o.value === p.value)?.label }}</span>
        </span>
        <span v-else class="text-sm text-stone-400 dark:text-zinc-500">{{ uloveOnly ? 'Кто может писать в ULove' : 'Кто может писать' }}</span>
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
