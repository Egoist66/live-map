<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Badge from 'primevue/badge'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useSavedNotes } from '@/composables/useSavedNotes'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { state, actions, localHint } = useSavedNotes()
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()
const confirm = (() => {
  try {
    return useConfirm()
  } catch {
    return null as any
  }
})()

/**
 * Локальная форма: черновик, поиск и редактирование (в стор не входит).
 */
const form = reactive({
  draft: '',
  query: '',
  editingId: null as number | null,
  editingBody: '',
})

const queryTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const initialized = ref(false)

const kindOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Текст', value: 'text' },
  { label: 'Ссылки', value: 'link' },
]

const kindModel = computed({
  get: () => state.kind.value,
  set: (v: 'all' | 'text' | 'link') => void actions.setKind(v),
})

const dialogVisible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (!initialized.value) {
      initialized.value = true
      void actions.init()
      return
    }
    void actions.reload()
  },
)

watch(
  () => form.query,
  (next) => {
    if (queryTimer.value) clearTimeout(queryTimer.value)
    queryTimer.value = setTimeout(() => void actions.setSearch(next), 350)
  },
)

/**
 * Разбить текст на обычный текст и ссылки для кликабельного вывода.
 *
 * @param body текст заметки
 */
function linkParts(body: string): { text: string; href: string | null }[] {
  const urlRe = /(https?:\/\/[^\s<>"')\]]+)/gu
  const parts: { text: string; href: string | null }[] = []
  let last = 0
  for (const match of body.matchAll(urlRe)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ text: body.slice(last, start), href: null })
    parts.push({ text: match[0], href: match[0] })
    last = start + match[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last), href: null })
  if (parts.length === 0) parts.push({ text: body, href: null })
  return parts
}

/**
 * Короткая дата заметки.
 *
 * @param iso ISO-дата
 */
function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Сохранить черновик новой заметкой.
 */
async function saveDraft(): Promise<void> {
  const ok = await actions.create(form.draft)
  if (!ok) {
    toast?.add({ severity: 'error', summary: 'Не сохранено', detail: state.error.value || 'Попробуйте позже', life: 3500 })
    return
  }
  form.draft = ''
  toast?.add({ severity: 'success', summary: 'Сохранено', detail: 'Заметка в «Избранном»', life: 2500 })
}

/**
 * Начать редактирование заметки.
 *
 * @param id id заметки
 * @param body текущий текст
 */
function startEdit(id: number, body: string): void {
  form.editingId = id
  form.editingBody = body
}

/**
 * Сохранить отредактированный текст.
 *
 * @param id id заметки
 */
async function saveEdit(id: number): Promise<void> {
  const ok = await actions.updateNote(id, form.editingBody)
  if (!ok) {
    toast?.add({ severity: 'error', summary: 'Не обновлено', detail: state.error.value || 'Попробуйте позже', life: 3500 })
    return
  }
  form.editingId = null
  form.editingBody = ''
}

/**
 * Скопировать текст заметки в буфер обмена.
 *
 * @param body текст заметки
 */
async function copyBody(body: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(body)
  } catch {
    toast?.add({ severity: 'warn', summary: 'Не скопировано', detail: 'Браузер запретил доступ к буферу', life: 3000 })
    return
  }
  toast?.add({ severity: 'success', summary: 'Скопировано', detail: 'Текст заметки в буфере обмена', life: 2000 })
}

/**
 * Удалить заметку после подтверждения.
 *
 * @param id id заметки
 */
function askDelete(id: number): void {
  if (!confirm) {
    void actions.removeNote(id)
    return
  }
  confirm.require({
    header: 'Убрать заметку?',
    message: 'Заметка будет удалена навсегда. Это нельзя отменить.',
    icon: 'pi pi-trash',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: () => void actions.removeNote(id),
  })
}

/**
 * Очистить всё избранное после подтверждения.
 */
function askClearAll(): void {
  if (state.notes.value.length === 0) return
  if (!confirm) {
    void actions.clearAll()
    return
  }
  confirm.require({
    header: 'Очистить избранное?',
    message: `Будет удалено заметок: ${state.total.value}. Это нельзя отменить.`,
    icon: 'pi pi-trash',
    acceptLabel: 'Очистить всё',
    rejectLabel: 'Отмена',
    accept: () => void actions.clearAll(),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    dismissable-mask
    header="⭐ Избранное"
    :style="{ width: '560px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px]' } }"
  >
    <div class="space-y-3">
      <p class="text-xs text-stone-500 dark:text-zinc-400">{{ localHint }}</p>

      <div class="flex gap-2">
        <span class="p-input-icon-left flex-1">
          <InputText
            v-model="form.query"
            placeholder="Найти в заметках…"
            class="w-full"
          />
        </span>
        <SelectButton v-model="kindModel" :options="kindOptions" option-label="label" option-value="value" aria-label="Фильтр заметок" />
      </div>

      <div class="flex gap-2 items-start">
        <Textarea
          v-model="form.draft"
          rows="2"
          auto-resize
          maxlength="10000"
          placeholder="Заметка, ссылка, мысль… (Enter — новая строка)"
          class="flex-1"
        />
        <Button
          icon="pi pi-send"
          rounded
          aria-label="Сохранить заметку"
          :loading="state.saving.value"
          :disabled="form.draft.trim() === ''"
          @click="saveDraft"
        />
      </div>

      <Message v-if="state.error.value" severity="error" :closable="false" class="w-full">{{ state.error.value }}</Message>

      <div v-if="state.loading.value && state.notes.value.length === 0" class="grid place-items-center py-8">
        <ProgressSpinner style="width: 40px; height: 40px" :stroke-width="6" />
      </div>

      <div v-else-if="state.notes.value.length === 0" class="text-center py-8 text-sm text-stone-500 dark:text-zinc-400">
        <p class="text-2xl mb-2">📝</p>
        <p v-if="form.query.trim() !== ''">Ничего не найдено — попробуйте другой запрос.</p>
        <p v-else>Пока пусто. Сохраните первую заметку выше — или шлите текст боту командой /notes.</p>
      </div>

      <ul v-else class="space-y-2 max-h-[46dvh] overflow-auto overscroll-contain pr-0.5">
        <li
          v-for="note in state.notes.value"
          :key="note.id"
          class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 px-3 py-2.5"
        >
          <div v-if="form.editingId !== note.id">
            <p class="text-sm whitespace-pre-wrap break-words dark:text-white">
              <template v-for="(part, i) in linkParts(note.body)" :key="i">
                <a
                  v-if="part.href"
                  :href="part.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sky-600 dark:text-sky-400 underline break-all"
                >{{ part.text }}</a>
                <span v-else>{{ part.text }}</span>
              </template>
            </p>
            <div class="mt-1.5 flex items-center gap-1.5">
              <Badge v-if="note.kind === 'link'" value="ссылка" severity="info" />
              <span class="text-[11px] text-stone-400">{{ formatDate(note.updated_at) }}</span>
              <span class="flex-1" />
              <Button icon="pi pi-copy" text rounded size="small" aria-label="Скопировать" @click="copyBody(note.body)" />
              <Button icon="pi pi-pencil" text rounded size="small" aria-label="Редактировать" @click="startEdit(note.id, note.body)" />
              <Button icon="pi pi-trash" text rounded severity="danger" size="small" aria-label="Удалить" @click="askDelete(note.id)" />
            </div>
          </div>
          <div v-else class="space-y-2">
            <Textarea v-model="form.editingBody" rows="3" auto-resize maxlength="10000" class="w-full" />
            <div class="flex gap-2 justify-end">
              <Button label="Отмена" text size="small" @click="form.editingId = null" />
              <Button label="Сохранить" size="small" :loading="state.saving.value" @click="saveEdit(note.id)" />
            </div>
          </div>
        </li>
      </ul>

      <div class="flex items-center gap-2">
        <span class="text-xs text-stone-500 dark:text-zinc-400">Всего: {{ state.total.value }}</span>
        <span class="flex-1" />
        <Button
          v-if="state.hasMore.value"
          label="Показать ещё"
          text
          size="small"
          :loading="state.loading.value"
          @click="actions.loadMore()"
        />
        <Button
          v-if="state.notes.value.length > 0"
          label="Очистить всё"
          text
          severity="danger"
          size="small"
          @click="askClearAll"
        />
      </div>
    </div>
  </Dialog>
</template>
