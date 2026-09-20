<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { useFlowComments } from '@/composables/useFlowComments'
import { useFlowRepost } from '@/composables/useFlowRepost'
import { usePhotoLightbox } from '@/composables/usePhotoLightbox'
import PhotoLightbox from '@/Components/Features/Media/PhotoLightbox.vue'
// Карусель на swiper — тяжёлая, грузится отдельным чанком параллельно.
const FlowMediaCarousel = defineAsyncComponent(() => import('@/Components/Features/Flow/FlowMediaCarousel.vue'))
import FlowPollCard from '@/Components/Features/Flow/FlowPollCard.vue'
import FlowRichText from '@/Components/Features/Flow/FlowRichText.vue'
import FlowRepostDialog from '@/Components/Features/Flow/FlowRepostDialog.vue'
import FlowCommentItem from '@/Components/Features/Flow/FlowCommentItem.vue'
import RepostIcon from '@/Components/Ui/Icons/RepostIcon.vue'
import { useLikersPreview } from '@/composables/useLikersPreview'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import LikersDialog from '@/Components/Features/Feedback/LikersDialog.vue'
import { formatFlowDate } from '@/utils/flowDate'
import type { FlowComment, FlowPost } from '@/types/flow'

const props = defineProps<{ post: FlowPost; likeBusy?: boolean }>()

const emit = defineEmits<{
  (e: 'like', id: number): void
  (e: 'edit', post: FlowPost): void
  (e: 'delete', id: number): void
  (e: 'tag', name: string): void
}>()

const expanded = ref(false)
const thread = useFlowComments(props.post.id)
const reposter = useFlowRepost()
const repostTarget = ref<FlowPost | null>(null)
const shown = computed(() => reposter.displayOf(props.post))
const isQuote = computed(() => !!props.post.repost_comment && !!props.post.repost)
const isReposted = computed(() => !!props.post.my_repost_id)
const lightbox = usePhotoLightbox()
const threadHasMore = computed(() => thread.hasMore.value)
const threadLoadingMore = computed(() => thread.loadingMore.value)
const { sentinel: threadSentinel } = useInfiniteScroll({
  hasMore: threadHasMore,
  loading: threadLoadingMore,
  onLoadMore: () => thread.loadMore(),
})
const postLikers = useLikersPreview(
  'flow',
  () => props.post?.id ?? null,
  () => props.post?.likes_count ?? 0,
)
const stopLive = thread.subscribeLive(() => expanded.value)
onUnmounted(() => stopLive())
const sharing = ref(false)
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null
  }
})()
const commentsOpened = computed(() => expanded.value)
const canWrite = computed(() => props.post.can_comment !== false)

async function toggleComments() {
  expanded.value = !expanded.value
  if (expanded.value && thread.comments.value.length === 0) await thread.load()
}

function replyName(c: FlowComment): string {
  return c.author?.name || 'Аноним'
}

/**
 * Поделиться постом: системный шаринг или копия ссылки в буфер.
 * Ссылка вида /flow?post=ID открывается у любого пользователя.
 */
async function share(): Promise<void> {
  if (sharing.value) return
  sharing.value = true
  const url = `${window.location.origin}/flow/post/${props.post.id}`
  try {
    const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: 'UFlow', text: props.post.body.slice(0, 120), url })
        return
      } catch (error) {
        const aborted = (error as { name?: string })?.name === 'AbortError'
        if (aborted) return
      }
    }
    let copied = false
    try {
      await navigator.clipboard.writeText(url)
      copied = true
    } catch {
      const area = document.createElement('textarea')
      area.value = url
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        copied = document.execCommand('copy')
      } catch {
        copied = false
      }
      document.body.removeChild(area)
    }
    if (copied) toast?.add({ severity: 'success', summary: 'Ссылка скопирована', detail: 'Отправьте её — пост откроется у любого пользователя', life: 3000 })
    else toast?.add({ severity: 'error', summary: 'Не вышло скопировать', detail: url, life: 4000 })
  } finally {
    sharing.value = false
  }
}
</script>

<template>
  <Card class="!rounded-3xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-soft overflow-hidden">
    <template #content>
      <article class="p-3 sm:p-5">
        <div class="flex items-start gap-3">
          <Avatar v-if="post.author.avatar_url" :image="post.author.avatar_url" shape="circle" class="!w-11 !h-11" />
          <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-11 !h-11 !bg-stone-900 !text-white dark:!bg-zinc-700" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              <Link v-if="post.author.id" :href="`/users/${post.author.id}`" class="truncate text-[15px] font-bold text-ink-900 dark:text-white hover:underline">
                {{ post.author.name }}
              </Link>
              <span v-else class="truncate text-[15px] font-bold text-ink-900 dark:text-white">{{ post.author.name }}</span>
              <span v-if="post.is_anonymous" class="shrink-0 inline-flex items-center gap-1 rounded-full bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                <i class="pi pi-eye-slash text-[10px]" />аноним
              </span>
            </div>
            <div class="text-xs text-stone-400">{{ formatFlowDate(post.created_at) }}</div>
          </div>
          <div v-if="post.can_edit || post.can_delete" class="flex shrink-0 gap-1">
            <Button v-if="post.can_edit" icon="pi pi-pencil" text rounded severity="secondary" class="!w-8 !h-8" @click="emit('edit', post)" />
            <Button v-if="post.can_delete" icon="pi pi-trash" text rounded severity="danger" class="!w-8 !h-8" @click="emit('delete', post.id)" />
          </div>
        </div>

        <h3 v-if="shown.title" class="mt-3 text-[17px] font-black leading-snug tracking-tight text-ink-900 dark:text-white break-words">{{ shown.title }}</h3>
        <p v-if="!isQuote" class="mt-1.5 text-[15px] leading-relaxed text-ink-900 dark:text-zinc-100" :class="!shown.title && 'mt-3'">
          <FlowRichText :text="shown.body || 'Оригинал удалён'" @tag="emit('tag', $event)" />
        </p>
        <div v-if="isQuote && post.repost_comment" class="mt-1.5 rounded-2xl rounded-tl-md bg-violet-50 dark:bg-violet-500/10 px-3 py-2 text-[14px] italic leading-relaxed text-stone-600 dark:text-zinc-300 break-words">
          «{{ post.repost_comment }}»
        </div>
        <FlowMediaCarousel
          v-if="post.media?.length"
          :media="post.media"
          @preview="(_url: string, i: number) => lightbox.openFlowMedia(post.media ?? [], i, shown.title || 'Фото поста')"
        />
        <div v-else-if="shown.imageUrl" class="mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-800">
          <button type="button" class="block w-full cursor-zoom-in" aria-label="Открыть фото на весь экран" @click="lightbox.openSingle(shown.imageUrl, shown.title || 'Фото поста')">
            <img :src="shown.imageUrl" alt="Фото поста" loading="lazy" class="max-h-[420px] w-full object-cover" />
          </button>
        </div>
        <FlowPollCard v-if="post.poll" :post-id="post.id" :poll="post.poll" :can-close="post.can_delete" />
        <button
          v-if="isQuote && post.repost"
          type="button"
          class="mt-3 block w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-800 text-left transition hover:border-violet-300"
          @click="reposter.goPost(post.repost.id)"
        >
          <div class="flex items-center gap-2 px-3 pt-2.5">
            <Avatar v-if="post.repost.author.avatar_url" :image="post.repost.author.avatar_url" shape="circle" class="!w-6 !h-6" />
            <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-6 !h-6 !bg-stone-200 dark:!bg-zinc-700" />
            <span class="truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ post.repost.author.name }}</span>
          </div>
          <div v-if="post.repost.title" class="px-3 pt-1 text-[14px] font-black leading-snug text-ink-900 dark:text-white break-words">{{ post.repost.title }}</div>
          <p class="px-3 pt-0.5 text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300 break-words">{{ reposter.originExcerpt(post.repost) }}</p>
          <img v-if="post.repost.image_url" :src="post.repost.image_url" alt="Фото оригинала" loading="lazy" class="mt-2 max-h-[220px] w-full object-cover" />
          <div class="pb-2.5" />
        </button>
        <PhotoLightbox :photos="lightbox.photos.value" :index="lightbox.index.value" :open="lightbox.open.value" @close="lightbox.close()" @update:index="(v: number) => lightbox.index.value = v" />

        <div class="mt-3 flex items-center gap-1 border-t border-stone-100 dark:border-zinc-800 pt-2">
          <Button
            :icon="post.liked ? 'pi pi-heart-fill' : 'pi pi-heart'"
            text
            rounded
            :loading="likeBusy"
            :class="[post.liked ? '!text-rose-500' : '!text-stone-500 dark:!text-zinc-400', '!w-10 !h-10']"
            @click="emit('like', post.id)"
            aria-label="Лайк"
            v-tooltip.bottom="postLikers.tooltip.value"
            @mouseenter="postLikers.ensure()"
          />
          <button v-if="post.likes_count > 0" @click="postLikers.open()" class="px-1 text-[13px] font-bold text-stone-500 dark:text-zinc-400 hover:underline" title="Кто лайкнул">{{ post.likes_count }}</button>
          <Button icon="pi pi-comment" text rounded severity="secondary" :label="String(post.comments_count)" @click="toggleComments()" />
          <Button
            v-if="!post.can_edit"
            text
            rounded
            severity="secondary"
            :class="isReposted ? '!text-emerald-500' : ''"
            :label="post.reposts_count > 0 ? String(post.reposts_count) : undefined"
            :loading="reposter.isBusy(post.id)"
            @click="repostTarget = post"
            aria-label="Репост себе на страницу"
            v-tooltip.bottom="isReposted ? 'Вы репостнули — открыть' : 'Репост себе на страницу'"
          >
            <template #icon><RepostIcon :size="18" /></template>
          </Button>
          <span class="flex-1" />
          <Button icon="pi pi-share-alt" text rounded severity="secondary" :loading="sharing" @click="share()" />
        </div>
        <div v-if="post.repost" class="mt-2 flex items-center gap-1.5 border-t border-stone-100 dark:border-zinc-800 pt-2 text-xs text-stone-400 dark:text-zinc-500">
          <RepostIcon :size="12" class="shrink-0 text-violet-500" />
          <span class="truncate">Репост от <span class="font-bold text-stone-500 dark:text-zinc-300">{{ post.repost.author.name }}</span></span>
        </div>

        <div v-if="expanded" class="mt-2 border-t border-stone-100 dark:border-zinc-800 pt-3">
          <div v-if="thread.loading.value" class="py-4 text-center text-sm text-stone-400">Загружаем комментарии…</div>
          <template v-else>
            <div v-if="thread.comments.value.length" class="mb-2 flex items-center gap-1 text-[11px] font-bold text-stone-400">
              <button :class="thread.sort.value === 'new' ? 'text-violet-600 dark:text-violet-300' : 'hover:underline'" @click="thread.setSort('new')">Сначала новые</button>
              <span>·</span>
              <button :class="thread.sort.value === 'top' ? 'text-violet-600 dark:text-violet-300' : 'hover:underline'" @click="thread.setSort('top')">Обсуждаемые</button>
            </div>
            <div v-if="!thread.comments.value.length" class="py-4 text-center text-sm text-stone-400">Пока тихо — станьте первым.</div>
            <div v-else class="space-y-3">
              <FlowCommentItem
                v-for="c in thread.comments.value"
                :key="c.id"
                :comment="c"
                :more="thread.hasMoreChildren"
                :loading="thread.isLoadingChildren"
                @reply="thread.setReply($event)"
                @remove="thread.remove($event)"
                @children="thread.loadChildren($event)"
              />
            </div>
          </template>
          <InfiniteSentinel :sentinel="threadSentinel" :has-more="thread.hasMore.value" :loading="thread.loadingMore.value" />

          <div v-if="canWrite" class="sticky bottom-0 -mx-1 mt-3 bg-white/95 pb-1 pt-2 backdrop-blur dark:bg-zinc-900/95">
            <div v-if="thread.replyTo.value" class="mb-2 flex min-w-0 items-center gap-2 rounded-full bg-violet-50 py-1.5 pl-3 pr-1.5 text-xs text-stone-600 dark:bg-violet-950/50 dark:text-zinc-300">
              <i class="pi pi-reply shrink-0 text-[11px] text-violet-500" />
              <span class="min-w-0 flex-1 truncate">Ответ для <b>{{ replyName(thread.replyTo.value) }}</b></span>
              <Button icon="pi pi-times" text rounded severity="secondary" class="!h-7 !w-7 shrink-0" @click="thread.setReply(null)" aria-label="Отменить ответ" />
            </div>
            <div class="flex min-w-0 items-end gap-1.5">
              <Button
                :icon="thread.anonymousReply.value ? 'pi pi-eye-slash' : 'pi pi-user-secret'"
                text
                rounded
                :severity="thread.anonymousReply.value ? 'warn' : 'secondary'"
                class="!h-11 !w-11 shrink-0"
                :aria-pressed="thread.anonymousReply.value"
                aria-label="Анонимный комментарий"
                title="Анонимно"
                @click="thread.anonymousReply.value = !thread.anonymousReply.value"
              />
              <div class="min-w-0 flex-1">
                <InputText
                  v-model="thread.draft.value"
                  placeholder="Написать комментарий…"
                  enterkeyhint="send"
                  class="w-full !rounded-2xl !border-0 !bg-stone-100 !py-3 !text-[16px] !leading-snug dark:!bg-zinc-800"
                  @keyup.enter="thread.send()"
                />
              </div>
              <Button icon="pi pi-send" rounded :loading="thread.sending.value" :disabled="!thread.draft.value.trim()" class="!h-11 !w-11 shrink-0" aria-label="Отправить" @click="thread.send()" />
            </div>
            <div class="hidden items-center gap-1 px-1 pt-1 text-[11px] text-stone-400 sm:inline-flex">
              <Checkbox v-model="thread.anonymousReply.value" binary inputId="anon-flow" />
              <label for="anon-flow">анонимно</label>
            </div>
          </div>
          <div v-else class="mt-3 flex items-center gap-2 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2.5 text-xs text-stone-500 dark:text-zinc-400">
            <i class="pi pi-lock shrink-0 text-[11px]" />
            <span>Автор ограничил комментарии</span>
          </div>
        </div>
        <button v-else-if="post.comments_count > 0" class="mt-2 text-[13px] font-semibold text-stone-500 hover:underline" @click="toggleComments()">
          Показать комментарии ({{ post.comments_count }})
        </button>
        <LikersDialog :visible="postLikers.opened.value" @update:visible="(v:boolean)=>{ v ? postLikers.open() : postLikers.close() }" title="Лайки" :likers="postLikers.likers.value" :loading="postLikers.loading.value" :total="postLikers.total.value" />
        <FlowRepostDialog :post="repostTarget" @close="repostTarget = null" />
      </article>
    </template>
  </Card>
</template>
