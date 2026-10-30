<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { getAvatarUrl } from '@/composables/useAvatar'
import UserAvatar from '@/Components/Ui/Media/UserAvatar.vue'

type ShareCandidate = {
  id: number
  name: string
  avatar_url?: string | null
  telegram_photo_url?: string | null
  avatar_path?: string | null
  can_message?: boolean
}

type Sharer = {
  isOpen: { value: boolean }
  postRef: { value: { type: string; title?: string | null; excerpt?: string | null; image_url?: string | null } | null }
  query: { value: string }
  comment: { value: string }
  candidates: { value: ShareCandidate[] }
  selectedIds: { value: number[] }
  loading: { value: boolean }
  searching: { value: boolean }
  sending: { value: boolean }
  selectedCount: { value: number }
  canSend: { value: boolean }
  close: () => void
  search: (v: string) => void
  toggle: (id: number) => void
  remove: (id: number) => void
  nameOf: (id: number) => string
  send: () => Promise<boolean>
}

const props = defineProps<{ sharer: Sharer }>()
const s = props.sharer
</script>

<template>
  <Dialog
    :visible="s.isOpen.value"
    modal
    dismissable-mask
    :draggable="false"
    class="!m-3 sm:!m-0 !w-[calc(100vw-1.5rem)] sm:!w-[28rem] dark:!bg-[#0F121F] dark:!border-white/10"
    @update:visible="(v: boolean) => { if (!v) s.close() }"
  >
    <template #header>
      <div class="flex min-w-0 items-center gap-2.5">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
          <i class="pi pi-send text-sm" />
        </span>
        <span class="min-w-0">
          <span class="block text-[15px] font-black leading-tight dark:text-white">Отправить как сообщение</span>
          <span class="block truncate text-xs text-stone-500 dark:text-zinc-400">
            {{ s.postRef.value?.title || s.postRef.value?.excerpt || 'Пост' }}
          </span>
        </span>
      </div>
    </template>

    <div class="flex min-w-0 flex-col gap-3">
      <div v-if="s.postRef.value?.image_url" class="flex items-center gap-2.5 overflow-hidden rounded-2xl border border-stone-200 dark:border-white/10">
        <img :src="s.postRef.value.image_url" alt="Превью поста" class="h-12 w-12 shrink-0 object-cover" />
        <div class="min-w-0 flex-1 py-1.5 pr-2">
          <div v-if="s.postRef.value.title" class="truncate text-[13px] font-bold dark:text-white">{{ s.postRef.value.title }}</div>
          <div v-if="s.postRef.value.excerpt" class="truncate text-xs text-stone-500 dark:text-zinc-400">{{ s.postRef.value.excerpt }}</div>
        </div>
      </div>

      <span class="p-input-icon-left w-full">
        <i class="pi pi-search" />
        <InputText
          :model-value="s.query.value"
          placeholder="Кому? Введите имя…"
          class="w-full !rounded-2xl"
          @update:model-value="(v: string | undefined) => s.search(v ?? '')"
        />
      </span>

      <div v-if="s.selectedIds.value.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="id in s.selectedIds.value"
          :key="id"
          class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-violet-600 py-1 pl-3 pr-1.5 text-xs font-bold text-white"
        >
          <span class="max-w-[140px] truncate">{{ s.nameOf(id) }}</span>
          <button
            type="button"
            class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30"
            aria-label="Убрать"
            @click="s.remove(id)"
          >
            <i class="pi pi-times text-[10px]" />
          </button>
        </span>
      </div>

      <div class="max-h-64 min-h-[120px] overflow-y-auto rounded-2xl border border-stone-200 dark:border-white/10">
        <div v-if="s.loading.value || s.searching.value" class="grid place-items-center py-8 text-sm text-stone-400">
          <span class="h-6 w-6 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
        </div>
        <div v-else-if="!s.candidates.value.length" class="px-4 py-8 text-center text-sm text-stone-400">
          Никого не нашли — введите минимум 2 буквы имени
        </div>
        <button
          v-for="u in s.candidates.value"
          v-else
          :key="u.id"
          type="button"
          :disabled="u.can_message === false"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50"
          @click="s.toggle(u.id)"
        >
          <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2" :class="s.selectedIds.value.includes(u.id) ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-300 dark:border-white/20 text-transparent'">
            <i class="pi pi-check text-[10px]" />
          </span>
          <UserAvatar :user="u" :icon="!getAvatarUrl(u) ? 'pi pi-user' : undefined" shape="circle" class="!h-9 !w-9 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-bold dark:text-white">{{ u.name }}</span>
            <span v-if="u.can_message === false" class="block text-[11px] text-red-500">нельзя написать</span>
          </span>
        </button>
      </div>

      <Textarea
        :model-value="s.comment.value"
        placeholder="Комментарий (необязательно)…"
        rows="2"
        maxlength="500"
        auto-resize
        class="w-full !rounded-2xl"
        @update:model-value="(v: string | undefined) => { s.comment.value = v ?? '' }"
      />
    </div>

    <template #footer>
      <div class="flex items-center gap-2">
        <span class="mr-auto text-xs text-stone-400">Выбрано: {{ s.selectedCount.value }}/10</span>
        <Button label="Отмена" text severity="secondary" @click="s.close()" />
        <Button
          label="Отправить"
          icon="pi pi-send"
          :loading="s.sending.value"
          :disabled="!s.canSend.value"
          @click="s.send()"
        />
      </div>
    </template>
  </Dialog>
</template>
