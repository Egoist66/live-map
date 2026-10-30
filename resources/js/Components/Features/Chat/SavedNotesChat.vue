<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Popover from 'primevue/popover'
import ProgressSpinner from 'primevue/progressspinner'
import MessageBubble from '@/Components/Features/Chat/MessageBubble.vue'
import { useSavedNotesChat } from '@/composables/useSavedNotesChat'
import { useChatLayout } from '@/composables/useChatLayout'

withDefaults(defineProps<{ showBack?: boolean }>(), { showBack: false })
const emit = defineEmits<{ (e: 'back'): void }>()

/** Скрытый file-input композера (клик по скрепке). */
const fileInput = ref<HTMLInputElement | null>(null)

/** Поповер настроек хранилища (шестерёнка в шапке). */
const storagePopover = ref<InstanceType<typeof Popover> | null>(null)

/**
 * Чат с собой («Избранное»): только отображение, вся логика —
 * в useSavedNotesChat (Правило №1). Рисуется как обычный диалог:
 * та же центральная колонка (`windowCardClass`), шапка, лента
 * из MessageBubble, композер. Переключатель хранилища живёт
 * в шестерёнке (Popover), тостов при переключении нет.
 */
const chat = useSavedNotesChat()
const { windowCardClass } = useChatLayout()

const storageOptions = [
  { label: 'На сервере', hint: 'Синхронизация между устройствами', icon: 'pi-cloud', value: 'server' as const },
  { label: 'Локально', hint: 'Только это устройство, без синхронизации', icon: 'pi-mobile', value: 'local' as const },
]

/**
 * Открыть поповер настроек хранилища.
 *
 * @param event клик по шестерёнке
 */
function toggleStorage(event: Event): void {
  storagePopover.value?.toggle(event)
}

/**
 * Переключить хранилище из поповера (без тостов).
 *
 * @param mode server|local
 */
async function selectStorage(mode: 'server' | 'local'): Promise<void> {
  if (chat.state.storageLoading.value) {
    return
  }

  if (mode === chat.state.storage.value) {
    storagePopover.value?.hide()
    return
  }

  await chat.onStorage(mode)
  storagePopover.value?.hide()
}
</script>

<template>
  <div :class="['flex', 'flex-col', 'h-full', 'min-h-0', 'min-w-0', 'w-full', 'max-w-full', 'bg-white', 'dark:bg-[#0F121F]', 'overflow-hidden', windowCardClass]">
    <div class="chat-header flex items-center gap-2 pl-1 pr-2 sm:px-4 py-2 border-b dark:border-white/10 shrink-0 bg-white/95 dark:bg-[#0F121F]/95 backdrop-blur sticky top-0 z-30 min-w-0 min-h-[60px]">
      <button v-if="showBack" type="button" aria-label="Назад" class="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 shrink-0 text-xl leading-none text-stone-600 dark:text-zinc-300" @click="emit('back')">‹</button>
      <span class="relative block shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white grid place-items-center text-xl">⭐</span>
      <span class="min-w-0 flex-1 block">
        <span class="block text-[16px] font-bold truncate dark:text-white leading-snug">Избранное</span>
        <span class="mt-0.5 block text-xs leading-none text-stone-500 dark:text-zinc-400">{{ chat.state.storage.value === 'local' ? 'только это устройство' : 'синхронизация включена' }}</span>
      </span>
      <span class="flex items-center gap-0.5 shrink-0">
        <Button :icon="chat.showSearch.value ? 'pi pi-times' : 'pi pi-search'" rounded text severity="secondary" aria-label="Поиск по заметкам" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="chat.showSearch.value = !chat.showSearch.value" />
        <Button icon="pi pi-cog" rounded text severity="secondary" aria-label="Настройки избранного" title="Настройки избранного" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="toggleStorage" />
        <Button v-if="chat.ordered.value.length > 0" icon="pi pi-trash" rounded text severity="danger" aria-label="Очистить всё" title="Очистить всё" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="chat.askClearAll()" />
      </span>
    </div>

    <Popover ref="storagePopover" :dismissable="true">
      <div class="w-72 max-w-[80vw] p-1">
        <div class="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Где хранить</div>
        <button
          v-for="o in storageOptions"
          :key="o.value"
          type="button"
          :disabled="chat.state.storageLoading.value"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition hover:bg-stone-50 dark:hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
          @click="selectStorage(o.value)"
        >
          <span class="w-9 h-9 shrink-0 grid place-items-center rounded-full bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-zinc-300">
            <i :class="['pi', o.icon, 'text-sm']" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-bold dark:text-white leading-tight">{{ o.label }}</span>
            <span class="block text-xs text-stone-500 dark:text-zinc-400 leading-snug truncate">{{ o.hint }}</span>
          </span>
          <i v-if="chat.state.storage.value === o.value" class="pi pi-check text-sm text-emerald-500 shrink-0" />
        </button>
        <div v-if="chat.state.storageLoading.value" class="flex items-center gap-2 px-3 py-2 text-xs text-stone-500 dark:text-zinc-400">
          <ProgressSpinner style="width: 18px; height: 18px" :stroke-width="6" />
          <span>Переключаем хранилище…</span>
        </div>
      </div>
    </Popover>

    <div v-if="chat.showSearch.value" class="shrink-0 px-2 sm:px-4 py-2 border-b dark:border-white/10">
      <InputText :model-value="chat.query.value" placeholder="Найти в заметках…" class="w-full !rounded-full" @update:model-value="(v:any)=>chat.setSearch(String(v ?? ''))" />
    </div>

    <div :ref="(el:any)=>chat.bindList(el)" class="relative flex-1 min-h-0 overflow-auto overscroll-contain p-3 sm:p-4 notes-chat-list">
      <div class="min-h-full flex flex-col">
        <div v-if="chat.state.hasMore.value" class="flex justify-center pb-3">
          <Button label="Показать более старые" icon="pi pi-chevron-up" rounded outlined size="small" severity="secondary" :loading="chat.state.loading.value" @click="chat.loadMore()" />
        </div>
        <div v-else-if="chat.state.loading.value && chat.ordered.value.length === 0" class="flex-1 grid place-items-center py-10">
          <ProgressSpinner style="width: 36px; height: 36px" :stroke-width="5" aria-label="Загрузка заметок" />
        </div>
        <div v-else-if="chat.ordered.value.length === 0" class="flex-1 grid place-items-center text-center px-6 py-10">
          <div>
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center mx-auto text-3xl mb-3">⭐</div>
            <div class="font-bold dark:text-white">Пока пусто</div>
            <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Пиши себе мысли, кидай ссылки, картинки и файлы — всё сложится сюда, как в чате.</div>
          </div>
        </div>
        <template v-else v-for="(m, mi) in chat.messages.value" :key="m?.id">
          <div v-if="chat.showDayDivider(chat.messages.value, mi)" class="flex justify-center pt-1 pb-2.5">
            <span class="rounded-full bg-stone-100 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold text-stone-500 dark:text-zinc-400">{{ chat.dayLabel(m?.created_at) }}</span>
          </div>
          <div class="pb-2.5">
            <div v-if="chat.editingId.value === m.id" class="flex justify-end min-w-0">
              <div class="bg-white dark:bg-white/10 border dark:border-white/10 rounded-2xl shadow-lg w-full max-w-[92%] min-w-0 p-2">
                <Textarea :model-value="chat.editingBody.value" rows="2" autoResize maxlength="10000" class="w-full !rounded-xl text-sm" placeholder="Текст заметки..." @update:model-value="(v:any)=>chat.editingBody.value = String(v ?? '')" @keydown="(e:any)=>chat.handleEnterToSend(e, () => chat.saveEdit())" @keydown.escape="chat.cancelEdit()" />
                <button v-if="m.attachment" type="button" class="mt-2 flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-zinc-400" @click="chat.editingRemoveFile.value = !chat.editingRemoveFile.value">
                  <i :class="['pi', chat.editingRemoveFile.value ? 'pi-check-square text-red-500' : 'pi-stop']" />
                  <span>📎 {{ m.attachment.name || 'Файл' }} — {{ chat.editingRemoveFile.value ? 'уберём при сохранении' : 'оставить файл' }}</span>
                </button>
                <div class="flex gap-1.5 mt-2 justify-end">
                  <Button label="Отмена" severity="secondary" text rounded size="small" @click="chat.cancelEdit()" />
                  <Button label="Сохранить" rounded size="small" :loading="chat.state.saving.value" :disabled="!chat.editingBody.value.trim()" @click="chat.saveEdit()" />
                </div>
              </div>
            </div>
            <template v-else>
              <MessageBubble :message="m" :own="true" status="" :time="chat.messageTime(m?.created_at)" @edit="chat.startEdit" @delete="(id:number)=>chat.askDelete(id)" />
              <div class="flex justify-end gap-0.5 pr-1 pt-0.5">
                <button type="button" aria-label="Скопировать текст" title="Скопировать" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-stone-100 dark:hover:bg-white/10 active:scale-90 transition" @click="chat.copyBody(String(m?.body ?? ''))"><i class="pi pi-copy text-xs" /></button>
                <button type="button" aria-label="Редактировать" title="Редактировать" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-stone-100 dark:hover:bg-white/10 active:scale-90 transition" @click="chat.startEdit(m)"><i class="pi pi-pencil text-xs" /></button>
                <button type="button" aria-label="Удалить" title="Удалить" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:!text-red-500 active:scale-90 transition" @click="chat.askDelete(Number(m?.id))"><i class="pi pi-trash text-xs" /></button>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <div data-notes-composer class="relative p-2 sm:p-3 border-t dark:border-white/10 bg-white dark:bg-[#0F121F] shrink-0 flex-none grow-0 basis-auto pb-[calc(0.5rem+var(--sab))] sm:pb-3 w-full max-w-full min-w-0">
      <div v-if="chat.attachError.value" class="text-[11px] text-red-600 dark:text-red-400 px-1 mb-1.5">{{ chat.attachError.value }}</div>
      <div v-if="chat.file.value" class="flex items-center gap-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800 rounded-2xl px-2.5 py-2 mb-2 min-w-0">
        <img v-if="chat.previewUrl.value" :src="chat.previewUrl.value" alt="" class="w-10 h-10 rounded-xl object-cover shrink-0" />
        <span v-else class="w-10 h-10 rounded-xl bg-violet-600/10 grid place-items-center shrink-0"><i class="pi pi-file text-lg text-violet-600 dark:text-violet-300" /></span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold truncate dark:text-zinc-100">{{ chat.file.value.name }}</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ (chat.file.value.size / 1024).toFixed(0) }} КБ · макс 10 МБ</div>
        </div>
        <button type="button" aria-label="Убрать файл" class="w-7 h-7 shrink-0 grid place-items-center rounded-full hover:bg-violet-100 dark:hover:bg-white/10 text-stone-500 active:scale-95 transition" @click="chat.clearPreview()"><i class="pi pi-times text-xs" /></button>
      </div>
      <div class="relative flex gap-2 items-end min-w-0 w-full max-w-full">
        <input ref="fileInput" type="file" class="hidden" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" @change="(e:any)=>{ const f = e.target.files?.[0] ?? null; chat.pickFile(f); e.target.value = '' }" />
        <Button icon="pi pi-paperclip" severity="secondary" outlined rounded aria-label="Прикрепить файл" class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" @click="fileInput?.click()" />
        <Textarea :model-value="chat.draft.value" rows="1" autoResize maxlength="10000" fluid placeholder="Сообщение себе…" class="chat-composer-input !rounded-3xl !bg-stone-100 dark:!bg-white/10 !border-0 !py-2.5 flex-1 min-w-0 max-h-32" enterkeyhint="enter" @update:model-value="(v:any)=>chat.draft.value = String(v ?? '')" @keydown="(e:any)=>chat.handleEnterToSend(e, () => chat.send())" @paste="(e:any)=>chat.onPasteImage(e as ClipboardEvent)" />
        <Button icon="pi pi-send" rounded aria-label="Отправить себе" :loading="chat.state.saving.value" :disabled="!chat.canSend.value" class="!w-11 !h-11 !p-0 !rounded-full !border-0 !bg-[#1786FF] !text-white hover:!bg-[#0f78e0] disabled:!opacity-40 shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0 shadow-md shadow-sky-500/30" @click="chat.send()" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-chat-list {
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.notes-chat-list::-webkit-scrollbar {
  width: 6px;
}
.notes-chat-list::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 130, 0.35);
  border-radius: 999px;
}
html.dark .notes-chat-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
}
</style>
