<script setup lang="ts">
import { watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import ToggleSwitch from 'primevue/toggleswitch'
import { useDatingQuestionnaire } from '@/composables/useDatingQuestionnaire'
import { DATING_GOAL_PRESETS, DATING_INTEREST_PRESETS } from '@/validation/schemas/dating.schema'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'saved'): void }>()

const q = useDatingQuestionnaire()
const { selectPt } = useDropdownMenuStyle()

watch(
  () => props.open,
  (v) => {
    if (v) q.resetFromUser()
  },
)

async function onSave() {
  const ok = await q.save()
  if (ok) {
    emit('saved')
    emit('update:open', false)
  }
}
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v:boolean)=>emit('update:open', v)"
    modal
    header="Моя анкета ULove"
    :style="{ width: '440px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{ root: { class: '!rounded-3xl dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: 'dark:!bg-zinc-900 dark:!text-white' }, content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto' } }"
  >
    <div class="flex flex-col gap-4 pt-1 min-w-0">
      <div class="flex items-center gap-3">
        <ToggleSwitch v-model="q.enabled.value" input-id="dating-enabled" />
        <label for="dating-enabled" class="text-sm font-semibold text-stone-700 dark:text-zinc-200">Показывать меня в ленте</label>
      </div>

      <div class="min-w-0">
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Что ищу (пресет)</label>
        <Select
          v-model="q.goal.value"
          :options="[{ label: 'Без цели', value: null }, ...DATING_GOAL_PRESETS]"
          option-label="label"
          option-value="value"
          placeholder="Выбери цель"
          class="w-full mt-1 dark:!border-zinc-700"
          :pt="selectPt"
        />
      </div>

      <div class="min-w-0">
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Или своё — коротко ({{ q.customLeft.value }})</label>
        <InputText v-model="q.customGoal.value" maxlength="60" placeholder="Например: ищу компанию для походов" class="w-full mt-1 dark:!border-zinc-700" />
        <div v-if="q.errors.value.dating_custom_goal" class="mt-1 text-xs text-rose-600">{{ q.errors.value.dating_custom_goal }}</div>
      </div>

      <div class="min-w-0">
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">О себе подробно ({{ q.aboutLeft.value }})</label>
        <Textarea v-model="q.about.value" rows="4" maxlength="1000" autoResize placeholder="Что любишь, что ищешь, как проводишь время..." class="w-full mt-1 dark:!border-zinc-700" />
        <div v-if="q.errors.value.dating_about" class="mt-1 text-xs text-rose-600">{{ q.errors.value.dating_about }}</div>
      </div>

      <div>
        <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Интересы · {{ q.interests.value.length }}/10</label>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <Chip
            v-for="t in DATING_INTEREST_PRESETS"
            :key="t"
            :label="`#${t}`"
            class="!rounded-full cursor-pointer text-xs"
            :style="q.interests.value.includes(t) ? '' : 'opacity:.55'"
            @click="q.togglePreset(t)"
          />
        </div>
        <div class="mt-2 flex gap-2">
          <InputText
            v-model="q.interestInput.value"
            maxlength="40"
            placeholder="Свой интерес + Enter"
            class="flex-1 min-w-0 dark:!border-zinc-700"
            @keydown.enter.prevent="q.addInterest(q.interestInput.value)"
          />
          <Button icon="pi pi-plus" rounded aria-label="Добавить интерес" @click="q.addInterest(q.interestInput.value)" />
        </div>
        <div v-if="q.interests.value.length" class="mt-2 flex flex-wrap gap-1.5">
          <Chip
            v-for="t in q.interests.value"
            :key="t"
            :label="`#${t}`"
            removable
            class="!rounded-full text-xs"
            @remove="q.removeInterest(t)"
          />
        </div>
        <div v-if="q.errors.value.dating_interests" class="mt-1 text-xs text-rose-600">{{ q.errors.value.dating_interests }}</div>
      </div>

      <div class="text-[11px] text-stone-400 dark:text-zinc-500">Свои тексты проверяются: политика, 18+, мат и т.д. запрещены.</div>
      <div v-if="q.serverError.value" class="text-sm text-rose-600 dark:text-rose-300">{{ q.serverError.value }}</div>

      <div class="flex gap-2 pb-[env(safe-area-inset-bottom,0px)]">
        <Button label="Отмена" severity="secondary" outlined rounded class="flex-1" @click="emit('update:open', false)" />
        <Button label="Сохранить" rounded class="flex-1" :loading="q.saving.value" @click="onSave()" />
      </div>
    </div>
  </Dialog>
</template>
