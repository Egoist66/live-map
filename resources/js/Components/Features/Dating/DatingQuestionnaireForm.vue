<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import ToggleSwitch from 'primevue/toggleswitch'
import FileUpload from 'primevue/fileupload'
import Message from 'primevue/message'
import type { FileUploadSelectEvent } from 'primevue/fileupload'
import { useToast } from 'primevue/usetoast'
import { useDatingQuestionnaire } from '@/composables/useDatingQuestionnaire'
import { useQuestionnaireAi } from '@/composables/useQuestionnaireAi'
import { useQuestionnaireTemplates } from '@/composables/useQuestionnaireTemplates'
import { DATING_GOAL_PRESETS, DATING_INTEREST_PRESETS } from '@/validation/schemas/dating.schema'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const emit = defineEmits<{ (e: 'saved', saved?: Record<string, any>): void }>()

const q = useDatingQuestionnaire()
const ai = useQuestionnaireAi()
const tpl = useQuestionnaireTemplates()
const { selectPt } = useDropdownMenuStyle()

/** Toast может быть не смонтирован на странице — не роняем форму. */
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null
  }
})()

/** Ключ FileUpload: после импорта сбрасывает выбранный файл. */
const importKey = ref(0)

/** Черновик подставлен: просим проверить перед сохранением. */
const draftApplied = ref(false)

/** Подсказка выбранного шаблона под дропдауном. */
const templateDesc = computed(() => {
  const found = tpl.templates.find((item) => item.id === tpl.selectedId.value)
  return found?.desc ?? ''
})

onMounted(() => q.resetFromUser())

/**
 * Сохранить анкету и уведомить родителя.
 */
async function onSave(): Promise<void> {
  const ok = await q.save()
  if (!ok) return
  draftApplied.value = false
  tpl.resetSelection()
  emit('saved', q.lastSaved.value ?? undefined)
}

/**
 * Выбрать шаблон из дропдауна: подставить в поля, сбросить AI-хинт.
 *
 * @param id id шаблона из Select
 */
function onTemplateSelect(id: string | null): void {
  draftApplied.value = false
  tpl.selectAndApply(q, id)
}

/**
 * Сгенерировать черновик по промпту и подставить в поля (можно править).
 */
async function onGenerate(): Promise<void> {
  draftApplied.value = false
  tpl.applied.value = false
  const draft = await ai.generate()
  if (!draft) return
  if (draft.goal) q.goal.value = draft.goal
  if (draft.custom_goal) q.customGoal.value = draft.custom_goal
  if (draft.about) q.about.value = draft.about
  q.interests.value = []
  for (const tag of draft.interests ?? []) q.addInterest(tag)
  draftApplied.value = true
}

/**
 * Скачать анкету файлом и показать результат.
 */
async function onExport(): Promise<void> {
  const ok = await q.exportQuestionnaire()

  if (ok) {
    toast?.add({ severity: 'success', summary: 'Анкета скачана', detail: 'Файл анкеты сохранён в аккаунт.', life: 3000 })
    return
  }

  toast?.add({
    severity: 'error',
    summary: 'Не удалось скачать анкету',
    detail: q.transferError.value ?? undefined,
    life: 4500,
  })
}

/**
 * Импортировать выбранный файл анкеты и обновить её поля.
 *
 * @param event событие выбора файла PrimeVue FileUpload
 */
async function onImportSelect(event: FileUploadSelectEvent): Promise<void> {
  const file = event.files?.[0]

  if (!file) {
    return
  }

  const ok = await q.importQuestionnaire(file)
  importKey.value += 1

  if (!ok) {
    toast?.add({
      severity: 'error',
      summary: 'Импорт не удался',
      detail: q.transferError.value ?? undefined,
      life: 5000,
    })
    return
  }

  draftApplied.value = false
  tpl.resetSelection()
  toast?.add({ severity: 'success', summary: 'Анкета загружена', detail: 'Поля обновлены из файла.', life: 3500 })
  emit('saved', q.lastSaved.value ?? undefined)
}
</script>

<!--
  Инлайн-форма анкеты ULove: создание и просмотр «о себе» прямо на странице.
  Логика — в useDatingQuestionnaire, компонент только отображает.
-->
<template>
  <div class="flex flex-col gap-4 min-w-0">
    <div class="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 p-3 dark:border-rose-500/30 dark:from-rose-500/10 dark:to-fuchsia-500/10">
      <div class="flex items-center gap-2">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-sm text-white"><i class="pi pi-bolt" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-black text-stone-800 dark:text-zinc-100">Готовый шаблон · заполни за секунду</div>
          <div class="truncate text-[11px] text-stone-500 dark:text-zinc-400">Выбери — поля подставятся, останется подправить</div>
        </div>
      </div>
      <Select
        :model-value="tpl.selectedId.value"
        :options="[...tpl.templates]"
        option-label="label"
        option-value="id"
        placeholder="Выбери шаблон анкеты..."
        class="w-full mt-2 dark:!border-white/10"
        :pt="selectPt"
        @update:model-value="onTemplateSelect"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2 min-w-0">
            <i :class="[option.icon, 'text-xs text-rose-500 shrink-0']" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-bold">{{ option.label }}</span>
              <span class="block truncate text-[11px] opacity-60">{{ option.desc }}</span>
            </span>
          </div>
        </template>
      </Select>
      <div v-if="templateDesc" class="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400">{{ templateDesc }}</div>
      <div v-if="tpl.applied.value" class="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">Шаблон подставлен — подправь под себя и нажми «Сохранить анкету».</div>
    </div>
    <div v-if="ai.canUse.value" class="rounded-2xl border border-violet-200 bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 p-3 dark:border-violet-500/30 dark:from-rose-500/10 dark:to-fuchsia-500/10">
      <div class="flex items-center gap-2">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-sm text-white"><i class="pi pi-sparkles" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-black text-stone-800 dark:text-zinc-100">AI-анкета · Premium</div>
          <div class="truncate text-[11px] text-stone-500 dark:text-zinc-400">Опиши себя парой фраз — ИИ заполнит поля</div>
        </div>
      </div>
      <Textarea
        v-model="ai.prompt.value"
        rows="2"
        maxlength="500"
        autoResize
        placeholder="Например: люблю походы и кино, ищу девушку для серьёзных отношений..."
        class="w-full mt-2 !rounded-xl !text-sm dark:!border-white/10"
      />
      <div class="mt-2 flex items-center gap-2">
        <span class="flex-1 text-[11px] text-stone-400 dark:text-zinc-500">Осталось {{ ai.promptLeft.value }}</span>
        <Button
          label="Создать анкету"
          icon="pi pi-sparkles"
          size="small"
          rounded
          :loading="ai.generating.value"
          :disabled="ai.prompt.value.trim().length < 3"
          class="!border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !text-white disabled:!opacity-50"
          @click="onGenerate()"
        />
      </div>
      <div v-if="ai.error.value" class="mt-1.5 text-xs text-rose-600 dark:text-rose-300">{{ ai.error.value }}</div>
      <div v-if="draftApplied" class="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">Черновик подставлен — проверь, подправь и нажми «Сохранить анкету».</div>
    </div>
    <Link
      v-else-if="ai.aiVisible.value"
      href="/settings/billing"
      class="flex items-center gap-2.5 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2.5 transition hover:bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/5 dark:hover:bg-violet-500/10"
    >
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-sm text-white"><i class="pi pi-crown" /></span>
      <span class="min-w-0 flex-1">
        <span class="block text-[13px] font-black text-stone-800 dark:text-zinc-100">AI-анкета · Premium</span>
        <span class="block truncate text-[11px] text-stone-500 dark:text-zinc-400">ИИ напишет анкету по твоему описанию</span>
      </span>
      <i class="pi pi-angle-right shrink-0 text-xs text-stone-400" />
    </Link>

    <div class="flex items-center gap-3">
      <ToggleSwitch v-model="q.enabled.value" input-id="dating-enabled" class="shrink-0" />
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
        class="w-full mt-1 dark:!border-white/10"
        :pt="selectPt"
      />
    </div>

    <div class="min-w-0">
      <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Или своё — коротко ({{ q.customLeft.value }})</label>
      <InputText v-model="q.customGoal.value" maxlength="60" placeholder="Например: ищу компанию для походов" class="w-full mt-1 dark:!border-white/10" />
      <div v-if="q.errors.value.dating_custom_goal" class="mt-1 text-xs text-rose-600">{{ q.errors.value.dating_custom_goal }}</div>
    </div>

    <div class="min-w-0">
      <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">О себе подробно ({{ q.aboutLeft.value }})</label>
      <Textarea v-model="q.about.value" rows="4" maxlength="1000" autoResize placeholder="Что любишь, что ищешь, как проводишь время..." class="w-full mt-1 dark:!border-white/10" />
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
          class="flex-1 min-w-0 dark:!border-white/10"
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
      <Message v-if="q.moderationWarning.value" severity="warn" :closable="false" class="mt-2 !rounded-xl !text-xs">
        {{ q.moderationWarning.value }}
      </Message>
    </div>

    <div class="text-[11px] text-stone-400 dark:text-zinc-500">Свои тексты проверяются: политика, 18+, мат, никнеймы и ссылки на соцсети запрещены.</div>
    <div v-if="q.serverError.value" class="text-sm text-rose-600 dark:text-rose-300">{{ q.serverError.value }}</div>

    <Button label="Сохранить анкету" icon="pi pi-check" rounded class="w-full !border-0 !bg-[#F6627B] !text-white shadow-lg shadow-rose-500/30 hover:!bg-[#e2556c] active:!bg-[#d84b61]" :loading="q.saving.value" @click="onSave()" />

    <div class="overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 dark:border-white/10 dark:bg-white/[0.04]">
      <Button
        text
        severity="secondary"
        class="!w-full !justify-start !rounded-none !px-3 !py-3 !text-left !text-stone-800 hover:!bg-stone-100/70 dark:!text-zinc-100 dark:hover:!bg-white/[0.05]"
        :aria-expanded="q.transferOpen.value"
        aria-controls="questionnaire-transfer-body"
        @click="q.toggleTransfer()"
      >
        <span class="flex w-full items-start gap-2.5">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-stone-500 shadow-sm dark:bg-white/[0.06] dark:text-zinc-300">
            <i class="pi pi-box text-sm" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-black text-stone-800 dark:text-zinc-100">Перенос анкеты</span>
            <span class="block text-[11px] leading-relaxed text-stone-500 dark:text-zinc-400">Скачать или загрузить анкету в другом аккаунте</span>
          </span>
          <i class="pi mt-1.5 shrink-0 text-xs text-stone-400 transition-transform dark:text-zinc-500" :class="q.transferOpen.value ? 'pi-chevron-up' : 'pi-chevron-down'" />
        </span>
      </Button>
      <div v-if="q.transferOpen.value" id="questionnaire-transfer-body" class="border-t border-stone-200/80 px-3 pb-3 pt-2.5 dark:border-white/10">
        <p class="text-[11px] leading-relaxed text-stone-500 dark:text-zinc-400">Импорт заменит текущую анкету.</p>
        <div class="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            label="Скачать"
            icon="pi pi-download"
            size="small"
            rounded
            class="!border-0 !bg-[#F6627B] !text-white shadow-sm shadow-rose-500/30 hover:!bg-[#e2556c] active:!bg-[#d84b61]"
            :loading="q.exporting.value"
            :disabled="q.importing.value"
            @click="onExport()"
          />
          <FileUpload
            :key="importKey"
            mode="basic"
            accept=".json,application/json"
            :auto="false"
            choose-label="Загрузить"
            choose-icon="pi pi-upload"
            :choose-button-props="{
              size: 'small',
              rounded: true,
              class: '!border-0 !bg-[#F6627B] !text-white shadow-sm shadow-rose-500/30 hover:!bg-[#e2556c] active:!bg-[#d84b61]'
            }"
            :disabled="q.importing.value || q.exporting.value"
            @select="onImportSelect"
          />
        </div>
        <div v-if="q.importing.value" class="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400">Загружаем анкету...</div>
        <Message v-if="q.transferError.value" severity="error" :closable="false" class="mt-2 !rounded-xl !text-xs">
          {{ q.transferError.value }}
        </Message>
      </div>
    </div>
  </div>
</template>
