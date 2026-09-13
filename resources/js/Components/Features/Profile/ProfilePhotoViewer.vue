<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import { useBodyLock } from '@/composables/useBodyLock'
import { usePhotoViewer } from '@/composables/usePhotoViewer'
import { usePhotoViewerSwiper } from '@/composables/usePhotoViewerSwiper'
import { useMentionInput } from '@/composables/useMentionInput'
import { useEnterToSend } from '@/composables/useEnterToSend'
import { renderWithMentions } from '@/composables/useMentions'
import { useMentionNavigate } from '@/composables/useMentionNavigate'
import { useLikersPreview } from '@/composables/useLikersPreview'
import LikersDialog from '@/Components/Features/Feedback/LikersDialog.vue'
import { avatarSrcFor } from '@/composables/useAvatar'

const props = defineProps<{ gallery: any; comments: any; isOwn: boolean; userName?: string; avatarSrc?: string }>()

useBodyLock(() => !!props.gallery.viewerOpen?.value)

const viewer = usePhotoViewer(props.gallery, props.comments)
const swiper = usePhotoViewerSwiper(props.gallery, { onEscape: () => props.gallery.close() })
const mentionInput = useMentionInput({
  getText: () => props.comments.draft.value ?? '',
  setText: (v: string) => { props.comments.draft.value = v },
})
const { handleEnterToSend, enterPlaceholder } = useEnterToSend()
const photoLikers = useLikersPreview(
  'photo',
  () => props.gallery.active.value?.id ?? null,
  () => props.gallery.active.value?.likes_count ?? 0,
)
const commentPlaceholder = enterPlaceholder('Добавить комментарий… Shift+Enter — новая строка', 'Добавить комментарий…')
const mentionNav = useMentionNavigate()

/**
 * Отправляет комментарий к фото и закрывает подсказки.
 */
function sendPhotoComment(): void {
  viewer.onSend()
  mentionInput.close()
}

const canComment = () => !!(props.gallery.active.value?.can_comment || props.gallery.canComment?.value)
</script>
<template>
  <Teleport to="body">
    <div v-if="gallery.viewerOpen.value && gallery.active.value" class="fixed inset-0 z-[2000] h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 md:mx-auto md:max-w-[720px] md:border-x md:border-stone-200/70 dark:md:border-white/10" role="dialog" aria-modal="true">
      <div class="shrink-0 flex items-center gap-2.5 pl-1 pr-3 h-14 border-b border-stone-200/70 dark:border-white/10">
        <Button icon="pi pi-arrow-left" rounded text class="!w-10 !h-10" @click="gallery.close()" aria-label="Назад" />
        <img v-if="avatarSrc" :src="avatarSrc" alt="" loading="lazy" draggable="false" class="block w-8 h-8 rounded-full object-cover object-center bg-stone-100 dark:bg-white/10" />
        <span v-else class="w-8 h-8 rounded-full bg-violet-100 dark:bg-white/10 grid place-items-center text-xs font-black text-violet-700 dark:text-zinc-200">{{ (userName || '?').slice(0, 1).toUpperCase() }}</span>
        <span class="font-bold text-sm truncate flex-1">{{ userName }}</span>
        <Button v-if="isOwn" icon="pi pi-trash" rounded text size="small" severity="danger" @click="viewer.confirmDelete.value = true" aria-label="Удалить фото" />
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div class="relative bg-black">
          <Swiper class="w-full" :slides-per-view="1" :space-between="0" :auto-height="true" :observer="true" :observe-parents="true" :update-on-window-resize="true" :initial-slide="swiper.activeIndex()" @swiper="swiper.registerMobile" @slideChange="swiper.onSlideChange">
            <SwiperSlide v-for="p in gallery.photos.value" :key="p.id" class="!flex items-center justify-center bg-black">
              <img :src="p.url" :alt="p.caption || 'Фото'" loading="lazy" draggable="false" class="block w-full max-h-[52dvh] object-contain object-center select-none" />
            </SwiperSlide>
          </Swiper>
          <Button icon="pi pi-chevron-left" rounded text size="small" class="!absolute left-1.5 top-1/2 -translate-y-1/2 z-10 !bg-black/40 !text-white !border-0 !w-9 !h-9" @click="gallery.stepPhoto(-1)" aria-label="Назад" />
          <Button icon="pi pi-chevron-right" rounded text size="small" class="!absolute right-1.5 top-1/2 -translate-y-1/2 z-10 !bg-black/40 !text-white !border-0 !w-9 !h-9" @click="gallery.stepPhoto(1)" aria-label="Вперёд" />
        </div>
        <div class="px-4 pt-2.5 flex items-center gap-1">
          <Button :icon="gallery.active.value.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" rounded text :loading="viewer.likeLoading.value" :class="['!w-10 !h-10', gallery.active.value.liked ? '!text-red-500' : '']" @click="viewer.onLike(viewer.incognito.value)" :aria-label="gallery.active.value.liked ? 'Убрать лайк' : 'Лайк'" v-tooltip.bottom="photoLikers.tooltip.value" @mouseenter="photoLikers.ensure()" />
          <Button icon="pi pi-comment" rounded text class="!w-10 !h-10" aria-label="Комментарии" />
          <span class="flex-1" />
          <template v-if="isOwn">
            <Button icon="pi pi-pencil" rounded text class="!w-10 !h-10" @click="viewer.editing.value ? viewer.cancelEdit() : viewer.startEdit()" aria-label="Редактировать подпись" />
            <Button icon="pi pi-refresh" rounded text class="!w-10 !h-10" @click="viewer.onPickReplace" aria-label="Заменить фото" />
            <input :ref="viewer.setReplaceInput" type="file" accept="image/*" class="hidden" @change="viewer.onReplaceFile" />
          </template>
          <label class="ml-1 flex items-center gap-1.5 border-l border-stone-200/70 dark:border-white/10 pl-2.5 text-[11px] text-stone-500 dark:text-zinc-400 cursor-pointer" title="Анонимный лайк — PRO">
            <input type="checkbox" v-model="viewer.incognito.value" :disabled="!viewer.canIncognito.value" class="accent-violet-600 w-3.5 h-3.5" />
            🕵️<span class="font-bold text-violet-500">PRO</span>
          </label>
        </div>
        <button type="button" class="px-4 text-sm font-black text-left hover:opacity-70" @click="photoLikers.open()" v-tooltip.bottom="photoLikers.tooltip.value" @mouseenter="photoLikers.ensure()">{{ gallery.active.value.likes_count }} отметок «Нравится»</button>
        <LikersDialog :visible="photoLikers.opened.value" @update:visible="(v:boolean)=>{ v ? photoLikers.open() : photoLikers.close() }" title="Лайки" :likers="photoLikers.likers.value" :loading="photoLikers.loading.value" :total="photoLikers.total.value" :base-z-index="3000" />
        <div class="px-4 mt-1.5">
          <div v-if="!viewer.editing.value && gallery.active.value.caption" class="text-sm break-words dark:text-zinc-100"><span class="font-bold mr-1">{{ userName }}</span>{{ gallery.active.value.caption }}</div>
          <div v-if="viewer.editing.value" class="flex gap-2">
            <InputText v-model="viewer.captionDraft.value" placeholder="Подпись…" maxlength="500" class="flex-1 min-w-0 !rounded-xl !text-sm" />
            <Button icon="pi pi-check" rounded size="small" :loading="viewer.saveLoading.value" class="!bg-violet-600 !border-violet-600 shrink-0" @click="viewer.onSaveCaption" aria-label="Сохранить" />
            <Button icon="pi pi-times" rounded text size="small" class="shrink-0" @click="viewer.cancelEdit" aria-label="Отмена" />
          </div>
        </div>
        <div class="px-4 mt-2 pb-4 space-y-3">
          <div v-if="comments.loading.value" class="grid place-items-center py-6"><ProgressSpinner class="!w-7 !h-7" /></div>
          <div v-else-if="!comments.comments.value.length" class="text-xs text-stone-400 py-2">Комментариев пока нет — стань первым</div>
          <div v-for="c in comments.comments.value" :key="c.id" :id="`photo-comment-${c.id}`" :class="['flex gap-2.5 items-start rounded-xl px-2 py-1 -mx-2', Number(gallery.highlightCommentId?.value) === Number(c.id) ? 'bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500/40' : '']">
            <span class="w-7 h-7 shrink-0 rounded-full bg-stone-200 dark:bg-white/10 grid place-items-center text-[11px] font-black text-stone-600 dark:text-zinc-200">{{ (c.user?.name || '?').slice(0, 1).toUpperCase() }}</span>
            <div class="min-w-0 flex-1 text-sm break-words dark:text-zinc-100"><span class="font-bold mr-1">{{ c.user?.name || 'Пользователь' }}</span><span class="comment-body" v-html="renderWithMentions(c.content || '')" @click="mentionNav.onRichClick"></span></div>
            <Button v-if="isOwn" icon="pi pi-times" text rounded size="small" class="!w-8 !h-8 shrink-0" @click="comments.remove(c.id)" aria-label="Удалить комментарий" />
          </div>
          <Message v-if="comments.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ comments.error.value }}</Message>
        </div>
      </div>
      <div class="shrink-0 px-3 pt-2.5 border-t border-stone-200/70 dark:border-white/10 pb-[max(0.625rem,var(--sab))]">
        <div v-if="canComment()" class="relative flex items-end gap-2">
          <span class="w-8 h-8 shrink-0 rounded-full bg-stone-200 dark:bg-white/10 grid place-items-center text-[11px] font-black text-stone-500">Вы</span>
          <Textarea v-model="comments.draft.value" :placeholder="commentPlaceholder" rows="1" autoResize maxlength="1000" enterkeyhint="enter" class="flex-1 min-w-0 !rounded-2xl !text-sm max-h-32" @input="mentionInput.onInput()" @click="mentionInput.onInput()" @focus="mentionInput.onFocus()" @keydown="(e:any)=>handleEnterToSend(e, sendPhotoComment)" />
          <Button icon="pi pi-send" rounded :loading="comments.sending.value" :disabled="!comments.draft.value.trim()" class="!bg-violet-600 !border-violet-600 shrink-0" @click="sendPhotoComment" aria-label="Отправить" />
          <div v-if="mentionInput.mentions.mentionOpen.value" class="absolute left-0 right-0 bottom-[calc(100%+8px)] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-float overflow-hidden z-30 max-h-56 overflow-y-auto">
            <div v-if="mentionInput.mentions.mentionLoading.value" class="px-4 py-3 text-xs text-stone-400">Ищем людей…</div>
            <template v-else>
              <button v-for="u in mentionInput.mentions.mentionResults.value" :key="u.id" type="button" @click="mentionInput.pick(u)" class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:bg-violet-100 transition text-left">
                <img :src="avatarSrcFor(u) || undefined" class="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                <span class="min-w-0"><span class="block text-[13px] font-bold truncate dark:text-zinc-100">@{{ u.name }}</span></span>
              </button>
              <div v-if="!mentionInput.mentions.mentionResults.value.length" class="px-4 py-3 text-xs text-stone-400">Никого не нашли</div>
            </template>
          </div>
        </div>
        <p v-else class="text-xs text-stone-400 px-1">Автор ограничил комментирование</p>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <Dialog :visible="viewer.confirmDelete.value" @update:visible="(v:boolean)=>viewer.confirmDelete.value=v" modal :closable="true" :draggable="false" :base-z-index="3000" :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }">
      <template #header><span class="font-bold">Удалить фото?</span></template>
      <p class="text-sm text-stone-600 dark:text-zinc-300">Удалить это фото без возможности восстановления?</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" text @click="viewer.confirmDelete.value = false" />
          <Button label="Удалить" severity="danger" @click="viewer.onDelete" />
        </div>
      </template>
    </Dialog>
  </Teleport>
</template>
<style scoped>
.comment-body :deep(.mention){color:#7c3aed;font-weight:700}
.comment-body :deep(.mention-link){cursor:pointer}
:global(.dark) .comment-body :deep(.mention){color:#a78bfa}
</style>
