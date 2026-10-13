<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import { SOS_WARNING_TEXT, SOS_WARNING_TITLE } from '@/composables/useSosConfirm'
import SosPinActions from '@/Components/Features/Map/SosPinActions.vue'
import CommentComposerModal from '@/Components/Features/Map/CommentComposerModal.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { pinBlurInfo } from '@/composables/useLocationBlur'
import { usePinLifetime } from '@/composables/usePinLifetime'
import { renderWithMentions } from '@/composables/useMentions'
import { useMentionNavigate } from '@/composables/useMentionNavigate'
import { useLikersPreview } from '@/composables/useLikersPreview'
import LikersDialog from '@/Components/Features/Feedback/LikersDialog.vue'
import { useCommentComposer } from '@/composables/useCommentComposer'
import { usePinCommentInput } from '@/composables/usePinCommentInput'
import { useEnterToSend } from '@/composables/useEnterToSend'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { formatTime } from '@/utils/date'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { usePinCompanyPhotos } from '@/composables/usePinCompanyPhotos'
import Galleria from 'primevue/galleria'
import PinInviteButton from '@/Components/Features/Map/PinInviteButton.vue'
import ModeratedContent from '@/Components/Features/Moderation/ModeratedContent.vue'

const props = withDefaults(defineProps<{ pin: any; comments: any[]; highlightCommentId?: number | null; commentText: string; creatingComment: boolean; editingCommentId: number | null; editingContent: string; savingComment: boolean; deletingCommentId?: number | null; reacting: boolean; reporting: boolean; pinEdit: any; categories: any[]; deleting: boolean; authId: number; isAdmin?: boolean; replyTo: any; mentions: any; commentsSentinel?: unknown; commentsHasMore?: boolean; commentsLoadingMore?: boolean }>(), { commentsHasMore: false, commentsLoadingMore: false })
const emit = defineEmits<{ (e: 'close'): void; (e: 'delete'): void; (e: 'react', k: string): void; (e: 'report'): void; (e: 'sendComment'): void; (e: 'update:comment', v: string): void; (e: 'update:editContent', v: string): void; (e: 'startEditComment', c: any): void; (e: 'cancelEditComment'): void; (e: 'saveEditComment'): void; (e: 'deleteComment', c: any): void; (e: 'saveEdit'): void; (e: 'reply', root: any, target: any): void; (e: 'cancelReply'): void; (e: 'sosChat', conversationId: number): void; (e: 'sosClosed'): void }>()
const blur = computed(() => pinBlurInfo(props.pin))
const companyGallery = usePinCompanyPhotos(() => props.pin)
const isSosPin = computed(() => String(props.pin?.category ?? '').toLowerCase() === 'sos')
const isEditingPin = computed(() => !!props.pinEdit?.editing?.value)
const catMeta = computed(() => (props.categories as any[]).find((c: any) => c.v === props.pin?.category) ?? null)
const lifetime = usePinLifetime(() => props.pin)
const commentBox = usePinCommentInput({ getText: () => props.commentText, emit: (e, v) => emit(e as any, v as any), mentions: props.mentions })
const { handleEnterToSend, enterPlaceholder } = useEnterToSend()
const editCommentPlaceholder = enterPlaceholder('Shift+Enter — новая строка', 'Новая строка')
const newCommentPlaceholder = enterPlaceholder('Написать комментарий... Shift+Enter — новая строка', 'Написать комментарий...')
const mentionNav = useMentionNavigate()
const { userProfileUrl } = useProfileUrl()
const pinLikers = useLikersPreview(
  'pin',
  () => props.pin?.id ?? null,
  () => props.pin?.reactions_count ?? 0,
)
const composer = useCommentComposer()
const composerRef = ref<any>(null)
const { cardRef, listRef, commentInput, cardStyle, onCommentInput, onInputFocus, pickMention, focusForReply, blurInput } = commentBox
function onReply(root: any, target?: any) {
  emit('reply', root, target ?? root)
  if (composer.useModalComposer.value) {
    composer.openComposer('create')
    return
  }
  focusForReply()
}
function onStartEdit(c: any) {
  emit('startEditComment', c)
  if (composer.useModalComposer.value) {
    nextTick(() => composer.openComposer('edit'))
  }
}
const composerDraft = computed({
  get: () => (composer.composerMode.value === 'edit' ? props.editingContent : props.commentText) ?? '',
  set: (v: string) => {
    if (composer.composerMode.value === 'edit') {
      emit('update:editContent', v)
    } else {
      emit('update:comment', v)
    }
  },
})
const composerTitle = computed(() => {
  if (composer.composerMode.value === 'edit') {
    return 'Редактировать комментарий'
  }
  if (props.replyTo) {
    const who = props.replyTo.is_anonymous ? 'анонима' : `@${props.replyTo.user?.name || 'пользователя'}`
    return `Ответ для ${who}`
  }
  return 'Комментарий'
})
const composerSending = computed(() => (composer.composerMode.value === 'edit' ? props.savingComment : props.creatingComment))
function onComposerDraftInput(cursor: number) {
  onCommentInput(cursor, composerDraft.value)
}
function onComposerPick(u: any) {
  try {
    const applied = props.mentions?.applyMention?.(composerDraft.value, u)
    if (!applied) {
      return
    }
    composerDraft.value = applied.text
    composerRef.value?.focusInput?.(applied.cursor)
  } catch {}
}
function onComposerSubmit() {
  if (!composerDraft.value.trim()) {
    return
  }
  if (composer.composerMode.value === 'edit') {
    emit('saveEditComment')
  } else {
    blurInput()
    emit('sendComment')
  }
  composer.closeComposer()
}
function onComposerCancel() {
  if (composer.composerMode.value === 'edit') {
    emit('cancelEditComment')
  }
  composer.closeComposer()
}
function onSend() {
  blurInput()
  emit('sendComment')
}
function authorName(c: any): string { return c?.is_anonymous ? 'аноним' : (c?.user?.name || 'пользователь') }
function canDeleteComment(c: any): boolean {
  if (!c) {
    return false
  }
  if (Number(c.user_id) === Number(props.authId)) {
    return true
  }
  return !!props.isAdmin
}
</script>
<template>
  <div v-if="pin" ref="cardRef" :style="cardStyle" :class="isEditingPin ? 'sm:max-h-[calc(100dvh-2rem)]' : 'sm:max-h-none'" class="above-bottomnav absolute inset-x-2 sm:inset-x-auto top-auto max-h-[72dvh] sm:right-4 sm:top-4 sm:w-[380px] bg-white dark:bg-zinc-900 rounded-[20px] shadow-float border border-stone-200 dark:border-zinc-700 flex flex-col overflow-hidden z-20">
    <div class="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-700 shrink-0 min-h-0 overflow-y-auto overscroll-contain" :class="isEditingPin ? 'max-h-[30dvh] sm:max-h-[280px]' : 'max-h-[44dvh] sm:max-h-[380px]'">
      <div v-if="!pinEdit.editing.value" class="flex justify-between items-start gap-3">
        <h3 class="font-bold leading-tight pr-2 text-[15px] break-words min-w-0 flex-1">{{ pin.title }}</h3>
        <div class="flex items-center gap-1 shrink-0">
          <Button v-if="pin.is_owner" icon="pi pi-pencil" rounded text size="small" @click="pinEdit.start(pin)" />
          <Button v-if="pin.is_owner" icon="pi pi-trash" severity="danger" rounded text size="small" :loading="deleting" @click="emit('delete')" />
          <Button icon="pi pi-times" rounded text size="small" @click="emit('close')" />
        </div>
      </div>
      <div v-else class="space-y-3">
        <InputText v-model="pinEdit.title.value" v-bind="pinEdit.titleAttrs" maxlength="100" placeholder="Заголовок" class="w-full !rounded-xl" />
        <Textarea v-model="pinEdit.body.value" rows="3" maxlength="1000" placeholder="Подробности" autoResize class="w-full !rounded-xl" />
        <div v-if="(pin as any).is_business">
          <InputText v-model="pinEdit.promo.value" maxlength="140" placeholder="Промо-подпись · видна на карте" class="w-full !rounded-xl" />
          <small class="text-[11px] text-indigo-500">Короткий завлекающий текст под пином. Пусто — покажем заголовок.</small>
        </div>
        <div class="flex gap-1.5 flex-wrap"><button v-for="c in categories" :key="c.v" @click="pinEdit.selectCategory(c.v)" :class="['px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95', (pinEdit.category.value as any) === c.v ? 'bg-stone-900 dark:bg-white text-white dark:text-ink-900 border-stone-900 dark:border-white' : 'bg-zinc-500/10 dark:bg-zinc-500/15 border-zinc-500/25 dark:border-zinc-500/30 text-ink-900 dark:text-zinc-200 hover:bg-zinc-500/20']">{{ c.i }} {{ c.l }}</button></div>
        <div class="flex gap-2">
          <Button label="Сохранить" rounded class="flex-1 !bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-stone-900 dark:!border-white" :loading="pinEdit.updating.value" @click="emit('saveEdit')" />
          <Button label="Отмена" severity="secondary" outlined rounded class="flex-1" @click="pinEdit.cancel()" />
        </div>
        <Dialog :visible="pinEdit.sos.showSosWarning.value" @update:visible="(v:boolean)=>{ if (!v) pinEdit.sos.cancelSos() }" modal :closable="false" :draggable="false" header="SOS" :style="{ width: '420px', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none !border-red-200 dark:!border-red-900' } }">
          <div class="flex items-start gap-3">
            <span class="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 grid place-items-center text-xl shrink-0">🆘</span>
            <div>
              <div class="text-[15px] font-black text-stone-900 dark:text-white">{{ SOS_WARNING_TITLE }}</div>
              <p class="mt-1.5 text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300">{{ SOS_WARNING_TEXT }}</p>
            </div>
          </div>
          <template #footer>
            <div class="flex gap-2 justify-end">
              <Button label="Отмена" severity="secondary" outlined rounded size="small" @click="pinEdit.sos.cancelSos()" />
              <Button label="Осознаю ответственность" severity="danger" rounded size="small" @click="pinEdit.sos.confirmSos()" />
            </div>
          </template>
        </Dialog>
      </div>
      <SosPinActions v-if="!pinEdit.editing.value && isSosPin" :pin-id="Number(pin.id)" :is-owner="!!pin.is_owner" :auth-id="Number(authId)" class="mt-3" @chat="(id:number)=>emit('sosChat', id)" @closed="emit('sosClosed')" />
      <ModeratedContent v-if="!pinEdit.editing.value && pin.body" :text="String(pin.body || '')" :moderation="(pin as any).moderation">
        <p class="text-sm text-stone-600 dark:text-zinc-300 mt-2 leading-relaxed break-words overflow-wrap-anywhere comment-body" v-html="renderWithMentions(pin.body || '')" @click="mentionNav.onRichClick"></p>
      </ModeratedContent>
      <div v-if="!pinEdit.editing.value && (pin as any).promo" class="mt-2 text-[13px] font-bold leading-snug bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl px-3 py-2 shadow-glow">📢 {{ (pin as any).promo }}</div>
      <div v-if="!pinEdit.editing.value && companyGallery.photos.value.length" class="mt-2 -mx-1">
        <Galleria
          :value="companyGallery.photos.value"
          :num-visible="3"
          :show-thumbnails="companyGallery.photos.value.length > 1"
          :show-indicators="companyGallery.photos.value.length > 1"
          :change-item-on-indicator-hover="false"
          :circular="companyGallery.photos.value.length > 1"
          container-class="!rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700"
        >
          <template #item="{ item }">
            <img :src="(item as any).url" :alt="(item as any).caption ?? 'Фото компании'" class="w-full h-44 sm:h-52 object-cover" loading="lazy" />
          </template>
          <template #thumbnail="{ item }">
            <img :src="(item as any).url" :alt="(item as any).caption ?? ''" class="w-14 h-14 object-cover rounded-lg" loading="lazy" />
          </template>
          <template #caption="{ item }">
            <div v-if="(item as any).caption" class="text-[12px] font-semibold bg-black/55 text-white rounded-full px-3 py-1">{{ (item as any).caption }}</div>
          </template>
        </Galleria>
      </div>
      <div v-if="!pinEdit.editing.value && (pin as any).is_invited" class="mt-2 text-[11px] leading-snug bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl px-2.5 py-1.5">🎫 Вас пригласили в этот пин — он виден вне зоны и страны</div>
      <div v-if="!pinEdit.editing.value && Number((pin as any).district_id) > 0" class="mt-2 text-[11px] leading-snug bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 rounded-xl px-2.5 py-1.5">🏘️ Пин района · видят только жители в своей зоне</div>
      <div v-if="!pinEdit.editing.value && blur" title="Точка на карте сдвинута от реального места" class="mt-2 text-[11px] leading-snug bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 rounded-xl px-2.5 py-1.5">📍 {{ blur.hint }}</div>
      <div v-if="!pinEdit.editing.value" class="flex flex-wrap gap-1.5 mt-3 items-center">
        <span class="text-xs bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 rounded-full px-2.5 py-1 font-medium">{{ catMeta ? `${catMeta.i} ${catMeta.l}` : pin.category }}</span>
        <span v-if="(pin.gender_audience ?? 'all') === 'female'" class="text-xs bg-pink-600 text-white rounded-full px-2.5 py-1 font-medium">👩 Только женщины</span>
        <span v-else-if="(pin.gender_audience ?? 'all') === 'male'" class="text-xs bg-sky-600 text-white rounded-full px-2.5 py-1 font-medium">👨 Только мужчины</span>
        <Link v-if="pin.user && !pin.is_anonymous" :href="userProfileUrl(pin.user)" class="hover:opacity-80"><Chip :label="`${pin.user?.name} · ${pin.user?.level || 'novice'}`" :image="avatarSrcFor(pin.user) || undefined" class="!bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-full !text-xs !text-ink-900 dark:!text-zinc-100" /></Link>
        <span class="text-xs bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-400/30 text-amber-800 dark:text-amber-300 rounded-full px-2.5 py-1">{{ pin.expires_at ? `до ${formatTime(pin.expires_at)}` : '∞ бессрочно' }}</span>
      </div>
      <div v-if="!pinEdit.editing.value" class="mt-3">
        <div class="flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-zinc-400"><span>❤️ {{ lifetime.label.value }}</span><span v-if="!lifetime.isEternal.value && !lifetime.isScheduled.value">{{ Math.round(lifetime.percent.value * 100) }}%</span></div>
        <div v-if="!lifetime.isEternal.value" class="mt-1 h-1.5 rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden"><div class="h-full rounded-full transition-all" :style="{ width: `${Math.round(lifetime.percent.value * 100)}%` }" :class="lifetime.tone.value === 'good' ? 'bg-emerald-500' : lifetime.tone.value === 'warn' ? 'bg-amber-500' : 'bg-red-500'" /></div>
      </div>
      <div v-if="!pinEdit.editing.value && pin.is_owner" class="mt-3">
        <PinInviteButton :pin-id="pin.id" :is-owner="pin.is_owner" />
      </div>
      <div class="flex gap-1.5 mt-4">
        <div :class="['flex-1 rounded-full text-xs font-semibold border transition flex items-center justify-center overflow-hidden', pin.my_reaction === 'like' ? 'bg-rose-500 text-white border-rose-500 shadow-[0_4px_16px_-4px_rgba(244,63,94,0.5)]' : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30 dark:border-rose-400/30 text-rose-600 dark:text-rose-300']" v-tooltip.bottom="pinLikers.tooltip.value" @mouseenter="pinLikers.ensure()">
          <button @click="emit('react', 'like')" :disabled="reacting" class="py-2.5 pl-4 pr-0.5 active:scale-95 transition disabled:opacity-50" aria-label="Лайк">❤️</button>
          <button @click="pinLikers.open()" class="py-2.5 pl-0.5 pr-4 font-bold hover:underline" title="Кто лайкнул">{{ pin.reactions_count || 0 }}</button>
        </div>
        <button @click="emit('react', 'fire')" :disabled="reacting" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50', pin.my_reaction === 'fire' ? 'bg-orange-500 text-white border-orange-500 shadow-[0_4px_16px_-4px_rgba(249,115,22,0.5)]' : 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/30 dark:border-orange-400/30 hover:bg-orange-500/20']">🔥</button>
        <button @click="emit('react', 'useful')" :disabled="reacting" :class="['px-4 rounded-full text-xs font-semibold border active:scale-95 transition disabled:opacity-50', pin.my_reaction === 'useful' ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-400/30 hover:bg-emerald-500/20']">👍</button>
        <button @click="emit('report')" :disabled="reporting" class="w-10 h-10 rounded-full grid place-items-center border active:scale-95 transition disabled:opacity-50 bg-zinc-500/10 dark:bg-zinc-500/15 border-zinc-500/25 dark:border-zinc-500/30 text-zinc-500 dark:text-zinc-300 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400">⚠</button>
      </div>
    </div>
    <div ref="listRef" class="flex-1 min-h-[140px] sm:min-h-[200px] overflow-y-auto overscroll-contain p-4 space-y-3 bg-stone-50/40 dark:bg-black/30" :class="isEditingPin ? 'min-h-[160px] sm:min-h-[240px]' : ''" style="webkit-overflow-scrolling: touch;">
      <div v-for="root in comments" :key="root.id" :id="`pin-comment-${root.id}`" :class="['bg-white dark:bg-zinc-800 border rounded-2xl p-3.5', Number(highlightCommentId) === Number(root.id) ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-stone-200 dark:border-zinc-700']">
        <div class="font-semibold text-xs flex items-center gap-2 dark:text-zinc-100">
          <img v-if="!root.is_anonymous" :src="avatarSrcFor(root.user)" class="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
          <span class="truncate">{{ authorName(root) }}</span>
          <span class="text-stone-400 dark:text-zinc-400 font-normal shrink-0">{{ formatTime(root.created_at) }}</span>
          <span v-if="(root.replies_count ?? (root.replies || []).length) > 0" class="ml-auto text-[10px] text-stone-400 dark:text-zinc-500 shrink-0">💬 {{ root.replies_count ?? (root.replies || []).length }}</span>
        </div>
        <ModeratedContent v-if="editingCommentId !== root.id || composer.useModalComposer.value" :text="String(root.content || '')" :moderation="(root as any).moderation">
          <div class="text-sm text-stone-700 dark:text-zinc-200 mt-1.5 break-words comment-body" v-html="renderWithMentions(root.content)" @click="mentionNav.onRichClick"></div>
        </ModeratedContent>
        <div v-else-if="!composer.useModalComposer.value" class="mt-2"><Textarea :model-value="editingContent" @update:model-value="(v:any)=>emit('update:editContent', v)" @keydown="(e:any)=>handleEnterToSend(e, () => emit('saveEditComment'))" rows="2" autoResize maxlength="1000" class="w-full !rounded-xl" placeholder="Shift+Enter — новая строка" /><div class="flex gap-2 mt-2"><Button label="Сохранить" size="small" rounded :loading="savingComment" @click="emit('saveEditComment')" /><Button label="Отмена" size="small" severity="secondary" outlined rounded @click="emit('cancelEditComment')" /></div></div>
        <div v-if="editingCommentId !== root.id || composer.useModalComposer.value" class="mt-2 flex gap-1 items-center">
          <Button label="Ответить" size="small" text @click="onReply(root)" />
          <Button v-if="root.user_id === authId" label="ред." size="small" text @click="onStartEdit(root)" />
          <Button v-if="canDeleteComment(root)" icon="pi pi-trash" severity="danger" size="small" text title="Удалить комментарий" aria-label="Удалить комментарий" :loading="Number(deletingCommentId) === Number(root.id)" @click="emit('deleteComment', root)" />
        </div>
        <div v-if="(root.replies || []).length" class="mt-2.5 ml-4 sm:ml-6 pl-3 border-l-2 border-violet-200 dark:border-violet-800 space-y-2.5">
          <div v-for="r in root.replies" :key="r.id" :id="`pin-comment-${r.id}`" :class="['rounded-xl px-2 py-1 -mx-2', Number(highlightCommentId) === Number(r.id) ? 'bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500/40' : '']">
            <div class="font-semibold text-xs flex items-center gap-2 dark:text-zinc-100">
              <img v-if="!r.is_anonymous" :src="avatarSrcFor(r.user)" class="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
              <span class="truncate">{{ authorName(r) }}</span>
              <span class="text-stone-400 dark:text-zinc-400 font-normal shrink-0">{{ formatTime(r.created_at) }}</span>
            </div>
            <ModeratedContent v-if="editingCommentId !== r.id || composer.useModalComposer.value" :text="String(r.content || '')" :moderation="(r as any).moderation">
              <div class="text-[13px] text-stone-700 dark:text-zinc-200 mt-1 break-words comment-body" v-html="renderWithMentions(r.content)" @click="mentionNav.onRichClick"></div>
            </ModeratedContent>
            <div v-else-if="!composer.useModalComposer.value" class="mt-2"><Textarea :model-value="editingContent" @update:model-value="(v:any)=>emit('update:editContent', v)" @keydown="(e:any)=>handleEnterToSend(e, () => emit('saveEditComment'))" rows="2" autoResize maxlength="1000" class="w-full !rounded-xl" placeholder="Shift+Enter — новая строка" /><div class="flex gap-2 mt-2"><Button label="Сохранить" size="small" rounded :loading="savingComment" @click="emit('saveEditComment')" /><Button label="Отмена" size="small" severity="secondary" outlined rounded @click="emit('cancelEditComment')" /></div></div>
            <div v-if="editingCommentId !== r.id || composer.useModalComposer.value" class="mt-1.5 flex gap-1 items-center">
              <Button label="Ответить" size="small" text @click="onReply(root, r)" />
              <Button v-if="r.user_id === authId" label="ред." size="small" text @click="onStartEdit(r)" />
              <Button v-if="canDeleteComment(r)" icon="pi pi-trash" severity="danger" size="small" text title="Удалить комментарий" aria-label="Удалить комментарий" :loading="Number(deletingCommentId) === Number(r.id)" @click="emit('deleteComment', r)" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="!comments.length" class="text-center py-10"><div class="text-xs text-stone-400 mt-2">Комментариев пока нет<br />Будь первым</div></div>
      <InfiniteSentinel :sentinel="commentsSentinel as any" :has-more="!!commentsHasMore" :loading="!!commentsLoadingMore" />
    </div>
    <div class="p-3 pb-[calc(0.75rem+var(--sab))] border-t bg-white dark:bg-zinc-900 dark:border-zinc-700 shrink-0">
      <div v-if="replyTo" class="mb-2 flex items-center gap-2 text-[11px] bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 rounded-full pl-3 pr-1.5 py-1 w-fit max-w-full">
        <span class="truncate">Ответ для {{ replyTo.is_anonymous ? 'анонима' : '@' + (replyTo.user?.name || 'пользователя') }}</span>
        <button type="button" @click="emit('cancelReply')" class="w-5 h-5 rounded-full grid place-items-center hover:bg-violet-200 dark:hover:bg-violet-800 shrink-0"><i class="pi pi-times text-[9px]"></i></button>
      </div>
      <form v-if="!composer.useModalComposer.value" @submit.prevent="onSend" class="relative flex gap-2 items-end">
        <Textarea ref="commentInput" :model-value="commentText" @update:model-value="(v:any)=>{ emit('update:comment', v); onCommentInput() }" @input="onCommentInput" @keyup="onCommentInput" @click="onCommentInput" @focus="onInputFocus" @keydown="(e:any)=>handleEnterToSend(e, onSend)" rows="1" autoResize maxlength="1000" enterkeyhint="enter" autocomplete="off" autocapitalize="sentences" :placeholder="newCommentPlaceholder" class="flex-1 !rounded-2xl max-h-32" :disabled="creatingComment" />
        <Button type="submit" icon="pi pi-send" rounded class="!bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-stone-900 dark:!border-white shrink-0" :loading="creatingComment" />
        <div v-if="mentions?.mentionOpen.value" class="absolute left-0 right-12 bottom-[calc(100%+8px)] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-float overflow-hidden z-30 max-h-56 overflow-y-auto">
          <div v-if="mentions.mentionLoading.value" class="px-4 py-3 text-xs text-stone-400">Ищем людей…</div>
          <template v-else>
            <button v-for="u in mentions.mentionResults.value" :key="u.id" type="button" @click="pickMention(u)" class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:bg-violet-100 transition text-left">
              <img :src="avatarSrcFor(u) || undefined" class="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
              <span class="min-w-0"><span class="block text-[13px] font-bold truncate dark:text-zinc-100">@{{ u.name }}</span></span>
            </button>
            <div v-if="!mentions.mentionResults.value.length" class="px-4 py-3 text-xs text-stone-400">Никого не нашли</div>
          </template>
        </div>
      </form>
      <button
        v-else
        type="button"
        class="w-full flex gap-2 items-center rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 px-3.5 py-2.5 text-left text-[15px] text-stone-400 dark:text-zinc-500 active:scale-[0.99] transition"
        @click="composer.openComposer('create')"
      >
        <span class="flex-1 truncate">{{ replyTo ? `Ответ для @${replyTo.is_anonymous ? 'анонима' : (replyTo.user?.name || 'пользователя')}` : commentText || 'Написать комментарий…' }}</span>
        <i class="pi pi-send text-sm shrink-0" />
      </button>
    </div>
    <CommentComposerModal
      ref="composerRef"
      :visible="composer.composerOpen.value"
      @update:visible="(v:boolean)=>{ if(!v) onComposerCancel() }"
      :mode="composer.composerMode.value"
      :title="composerTitle"
      :draft="composerDraft"
      @update:draft="(v:string)=>{ composerDraft = v }"
      :placeholder="composer.composerMode.value === 'edit' ? 'Новая строка' : 'Написать комментарий…'"
      :sending="!!composerSending"
      :mentions="mentions"
      :lift-style="composer.liftStyle.value"
      @draft-input="onComposerDraftInput"
      @pick-mention="onComposerPick"
      @submit="onComposerSubmit"
      @cancel="onComposerCancel"
    />
    <LikersDialog :visible="pinLikers.opened.value" @update:visible="(v:boolean)=>{ v ? pinLikers.open() : pinLikers.close() }" title="Реакции" :likers="pinLikers.likers.value" :loading="pinLikers.loading.value" :total="pinLikers.total.value" show-type />
  </div>
</template>
<style scoped>
.comment-body :deep(.mention){color:#7c3aed;font-weight:700}
.comment-body :deep(.mention-link){cursor:pointer}
:global(.dark) .comment-body :deep(.mention){color:#a78bfa}
</style>
