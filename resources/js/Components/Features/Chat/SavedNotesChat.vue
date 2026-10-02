<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import MessageBubble from '@/Components/Features/Chat/MessageBubble.vue'
import { useSavedNotesChat } from '@/composables/useSavedNotesChat'

withDefaults(defineProps<{ showBack?: boolean; showClose?: boolean; embedded?: boolean }>(), { showBack: false, showClose: false, embedded: false })
const emit = defineEmits<{ (e: 'back'): void; (e: 'close'): void }>()

/** Скрытый file-input композера (клик по скрепке). */
const fileInput = ref<HTMLInputElement | null>(null)

/**
 * Чат с собой («Избранное»): только отображение, вся логика —
 * в useSavedNotesChat (Правило №1). Пузырьки — общий MessageBubble,
 * как в диалоге с человеком. В `embedded` режиме (внутри
 * SavedNotesDialog) убирает свою рамку, в `showClose` — рисует
 * крестик закрытия.
 */
const chat = useSavedNotesChat()

const storageOptions = [
  { label: '☁️ На сервере', value: 'server' },
  { label: '📱 Локально', value: 'local' },
]
</script>

<template>
  <div
    class="flex flex-col h-full min-h-0 min-w-0 bg-white dark:bg-zinc-900 overflow-hidden"
    :class="embedded ? 'rounded-none border-0' : 'rounded-none sm:rounded-3xl border-0 sm:border border-stone-200 dark:border-zinc-800'"
  >
    <div class="chat-header flex items-center gap-2 pl-1 pr-2 sm:px-4 py-2 border-b dark:border-zinc-800 shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur sticky top-0 z-30 min-w-0 min-h-[60px]">
      <button v-if="showBack" type="button" aria-label="Назад" class="w-9 h-9 grid place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 shrink-0 text-xl leading-none text-stone-600 dark:text-zinc-300" @click="emit('back')">‹</button>
      <span class="relative block shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center text-xl">⭐</span>
      <span class="min-w-0 flex-1 block">
        <span class="block text-[16px] font-bold truncate dark:text-white leading-snug">Избранное</span>
        <span class="mt-0.5 block text-xs leading-none text-stone-500 dark:text-zinc-400">чат с собой · {{ chat.state.storage.value === 'local' ? 'только это устройство' : 'синхронизация включена' }}</span>
      </span>
      <span class="flex items-center gap-0.5 shrink-0">
        <Button :icon="chat.showSearch.value ? 'pi pi-times' : 'pi pi-search'" rounded text severity="secondary" aria-label="Поиск по заметкам" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="chat.showSearch.value = !chat.showSearch.value" />
        <Button v-if="chat.ordered.value.length > 0" icon="pi pi-trash" rounded text severity="danger" aria-label="Очистить всё" title="Очистить всё" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="chat.askClearAll()" />
        <Button v-if="showClose" icon="pi pi-times" rounded text severity="secondary" aria-label="Закрыть избранное" title="Закрыть" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" @click="emit('close')" />
      </span>
    </div>

    <div v-if="chat.showSearch.value" class="shrink-0 px-2 sm:px-4 py-2 border-b dark:border-zinc-800">
      <InputText :model-value="chat.query.value" placeholder="Найти в заметках…" class="w-full !rounded-full" @update:model-value="(v:any)=>chat.setSearch(String(v ?? ''))" />
    </div>

    <div class="shrink-0 px-2 sm:px-4 py-2 border-b dark:border-zinc-800 flex items-center gap-2 min-w-0">
      <div class="notes-storage-switch" role="group" aria-label="Где хранить избранное">
        <button
          v-for="o in storageOptions"
          :key="o.value"
          type="button"
          class="notes-opt"
          :class="{ 'is-active': chat.state.storage.value === o.value }"
          :aria-pressed="chat.state.storage.value === o.value"
          :disabled="chat.state.storageLoading.value"
          @click="chat.onStorage(o.value as any)"
        >{{ o.label }}</button>
      </div>
      <ProgressSpinner v-if="chat.state.storageLoading.value" style="width: 22px; height: 22px" :stroke-width="6" class="shrink-0" />
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
            <span class="rounded-full bg-stone-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-stone-500 dark:text-zinc-400">{{ chat.dayLabel(m?.created_at) }}</span>
          </div>
          <div class="pb-2.5">
            <div v-if="chat.editingId.value === m.id" class="flex justify-end min-w-0">
              <div class="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl shadow-lg w-full max-w-[92%] min-w-0 p-2">
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
                <button type="button" aria-label="Скопировать текст" title="Скопировать" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-90 transition" @click="chat.copyBody(String(m?.body ?? ''))"><i class="pi pi-copy text-xs" /></button>
                <button type="button" aria-label="Редактировать" title="Редактировать" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-90 transition" @click="chat.startEdit(m)"><i class="pi pi-pencil text-xs" /></button>
                <button type="button" aria-label="Удалить" title="Удалить" class="w-8 h-8 grid place-items-center rounded-full text-stone-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:!text-red-500 active:scale-90 transition" @click="chat.askDelete(Number(m?.id))"><i class="pi pi-trash text-xs" /></button>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <div data-notes-composer class="relative p-2 sm:p-3 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex-none grow-0 basis-auto pb-[calc(0.5rem+var(--sab))] sm:pb-3 w-full max-w-full min-w-0">
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
        <Textarea :model-value="chat.draft.value" rows="1" autoResize maxlength="10000" fluid placeholder="Сообщение себе…" class="chat-composer-input !rounded-3xl !bg-stone-100 dark:!bg-zinc-800 !border-0 !py-2.5 flex-1 min-w-0 max-h-32" enterkeyhint="enter" @update:model-value="(v:any)=>chat.draft.value = String(v ?? '')" @keydown="(e:any)=>chat.handleEnterToSend(e, () => chat.send())" @paste="(e:any)=>chat.onPasteImage(e as ClipboardEvent)" />
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
/* Сегмент-переключатель хранилища: свои кнопки, ноль бордеров,
   ноль розового. Светлая: активный — белая плашка с тенью.
   Тёмная: активный — светло-серый, текст белый. */
.notes-storage-switch {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  gap: 2px;
  padding: 3px;
  border: 0;
  border-radius: 9999px;
  background: #ececea;
}
html.dark .notes-storage-switch {
  background: #27272a;
}
.notes-opt {
  flex: 1 1 0;
  min-width: 0;
  min-height: 40px;
  padding: 0.45rem 0.5rem;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: #78716c;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.12s ease, opacity 0.2s ease;
}
.notes-opt:active {
  transform: scale(0.97);
}
.notes-opt:disabled {
  cursor: default;
  opacity: 0.6;
}
.notes-opt.is-active {
  background: #ffffff;
  color: #1c1917;
  box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.25);
}
html.dark .notes-opt {
  color: #a1a1aa;
}
html.dark .notes-opt.is-active {
  background: #52525b;
  color: #ffffff;
  box-shadow: 0 2px 12px -2px rgba(0, 0, 0, 0.6);
}
.notes-opt:focus-visible {
  outline: 2px solid #a1a1aa;
  outline-offset: 2px;
}
</style>
