<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import { useDistrictNewsComments } from '@/composables/useDistrictNewsComments'
import { usePhotoLightbox } from '@/composables/usePhotoLightbox'
import PhotoLightbox from '@/Components/Features/Media/PhotoLightbox.vue'
import PostShareDialog from '@/Components/Features/Chat/PostShareDialog.vue'
import { usePostShare } from '@/composables/usePostShare'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useAutoFocusInput } from '@/composables/useAutoFocusInput'
import { formatFlowDate } from '@/utils/flowDate'
import { useProfileUrl } from '@/composables/useProfileUrl'
import CompanyNewsBadge from '@/Components/Features/Business/CompanyNewsBadge.vue'
import type { DistrictPost } from '@/types/entities/DistrictPost'

const props = defineProps<{
  post: DistrictPost
  districtId: number
  canComment: boolean
  likeBusy: boolean
}>()

const emit = defineEmits<{
  (e: 'like', id: number): void
  (e: 'edit', post: DistrictPost): void
  (e: 'delete', id: number): void
  (e: 'comments-delta', postId: number, delta: number): void
}>()

const expanded = ref(false)
const lightbox = usePhotoLightbox()
const sharer = usePostShare()
const thread = useDistrictNewsComments(
  props.districtId,
  props.post.id,
  (delta: number) => emit('comments-delta', props.post.id, delta),
)
/** Коммент в фокусе сразу при разворачивании ветки — писать можно без клика. */
const { target: commentTarget, focus: focusComment } = useAutoFocusInput(expanded)
watch(() => thread.replyTo.value, (next, prev) => {
  if (next && next !== prev) focusComment()
})

const commentsOpened = computed(() => expanded.value)
const threadHasMore = computed(() => thread.hasMore.value)
const threadLoadingMore = computed(() => thread.loadingMore.value)
const { sentinel: threadSentinel } = useInfiniteScroll({ hasMore: threadHasMore, loading: threadLoadingMore, onLoadMore: () => thread.loadMore() })
const { userProfileUrl } = useProfileUrl()

async function toggleComments(): Promise<void> {
  expanded.value = !expanded.value
  if (expanded.value && thread.comments.value.length === 0) {
    await thread.load()
  }
}

/**
 * Открыть модалку «Отправить как сообщение»: выбор получателей.
 */
function openShareDialog(): void {
  sharer.open({
    type: 'district',
    id: props.post.id,
    district_id: props.post.district_id,
    title: props.post.title,
    excerpt: String(props.post.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || null,
    image_url: props.post.image_url,
    author_name: props.post.author?.name ?? null,
  })
}

const stopThreadLive = thread.subscribeLive(() => expanded.value)
onBeforeUnmount(() => {
  try {
    stopThreadLive()
  } catch {}
})
</script>

<template>
  <Card class="!overflow-hidden !rounded-3xl !border-stone-200 !bg-white !shadow-soft dark:!border-zinc-800 dark:!bg-zinc-900">
    <template #content>
      <article class="p-3 sm:p-5">
        <div class="flex items-start gap-3">
          <CompanyNewsBadge v-if="(post as any).company" :company="(post as any).company" class="min-w-0 flex-1" />
          <template v-else>
            <Avatar v-if="post.author.avatar_url" :image="post.author.avatar_url" shape="circle" class="!h-11 !w-11" />
            <Avatar v-else icon="pi pi-megaphone" shape="circle" class="!h-11 !w-11 !bg-blue-600 !text-white" />
            <div class="min-w-0 flex-1">
              <Link v-if="post.author.id" :href="userProfileUrl(post.author)" class="truncate text-[15px] font-bold text-ink-900 hover:underline dark:text-white">
                {{ post.author.name }}
              </Link>
              <span v-else class="truncate text-[15px] font-bold text-ink-900 dark:text-white">{{ post.author.name }}</span>
              <div class="text-xs text-stone-400">{{ formatFlowDate(post.created_at) }}</div>
            </div>
          </template>
          <div v-if="post.can_edit || post.can_delete" class="flex shrink-0 gap-1">
            <Button v-if="post.can_edit" icon="pi pi-pencil" text rounded severity="secondary" class="!h-8 !w-8" @click="emit('edit', post)" />
            <Button v-if="post.can_delete" icon="pi pi-trash" text rounded severity="danger" class="!h-8 !w-8" @click="emit('delete', post.id)" />
          </div>
        </div>

        <h3 v-if="post.title" class="mt-3 break-words text-[17px] font-black leading-snug tracking-tight text-ink-900 dark:text-white">{{ post.title }}</h3>
        <p class="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-900 dark:text-zinc-100" :class="!post.title && 'mt-3'">{{ post.body }}</p>
        <div v-if="post.image_url" class="mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-800">
          <button type="button" class="block w-full cursor-zoom-in" aria-label="Открыть фото на весь экран" @click="lightbox.openSingle(post.image_url, post.title || 'Фото новости')">
            <img :src="post.image_url" alt="Фото новости" loading="lazy" class="max-h-[420px] w-full object-cover" />
          </button>
        </div>
        <PhotoLightbox :photos="lightbox.photos.value" :index="lightbox.index.value" :open="lightbox.open.value" @close="lightbox.close()" @update:index="(v: number) => lightbox.index.value = v" />

        <div class="mt-3 flex items-center gap-1 border-t border-stone-100 pt-2 dark:border-zinc-800">
          <Button
            :icon="post.liked ? 'pi pi-heart-fill' : 'pi pi-heart'"
            text
            rounded
            :loading="likeBusy"
            :class="[post.liked ? '!text-rose-500' : '!text-stone-500 dark:!text-zinc-400', '!h-10 !w-10']"
            aria-label="Лайк"
            @click="emit('like', post.id)"
          />
          <span v-if="post.likes_count > 0" class="px-1 text-[13px] font-bold text-stone-500 dark:text-zinc-400">{{ post.likes_count }}</span>
          <Button icon="pi pi-comment" text rounded severity="secondary" :label="String(post.comments_count)" @click="toggleComments()" />
          <span class="flex-1" />
          <Button icon="pi pi-send" text rounded severity="secondary" aria-label="Отправить как сообщение" title="Отправить как сообщение" v-tooltip.bottom="'Отправить как сообщение'" @click="openShareDialog()" />
        </div>

        <div v-if="expanded" class="mt-2 border-t border-stone-100 pt-3 dark:border-zinc-800">
          <div v-if="thread.loading.value" class="py-4 text-center text-sm text-stone-400">Загружаем комментарии…</div>
          <div v-else-if="!thread.comments.value.length" class="py-4 text-center text-sm text-stone-400">Пока тихо — станьте первым.</div>
          <div v-else class="space-y-3">
            <div v-for="c in thread.comments.value" :key="c.id" class="flex min-w-0 gap-2.5">
              <Avatar v-if="c.author.avatar_url" :image="c.author.avatar_url" shape="circle" class="!h-8 !w-8 shrink-0" />
              <Avatar v-else icon="pi pi-user" shape="circle" class="!h-8 !w-8 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
              <div class="min-w-0 flex-1">
                <div class="min-w-0 rounded-2xl bg-stone-100 px-3 py-2 dark:bg-zinc-800">
                  <div class="truncate text-[13px] font-bold leading-tight text-ink-900 dark:text-white">{{ c.author.name }}</div>
                  <div class="mt-0.5 whitespace-pre-line break-words text-[14px] leading-[1.5] text-stone-700 [overflow-wrap:anywhere] dark:text-zinc-200">{{ c.content }}</div>
                </div>
                <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pt-1 text-xs text-stone-400">
                  <span class="shrink-0">{{ formatFlowDate(c.created_at) }}</span>
                  <button v-if="canComment" class="shrink-0 px-1 py-1.5 font-semibold text-stone-500 active:text-violet-600 dark:text-zinc-400" @click="thread.setReply(c)">Ответить</button>
                  <button v-if="c.can_delete" class="shrink-0 px-1 py-1.5 active:text-red-500" @click="thread.remove(c)">Удалить</button>
                </div>
                <div v-if="c.replies?.length" class="mt-1.5 space-y-2.5 border-l-2 border-stone-200 pl-2.5 dark:border-zinc-700">
                  <div v-for="r in c.replies" :key="r.id" class="flex min-w-0 gap-2">
                    <Avatar v-if="r.author.avatar_url" :image="r.author.avatar_url" shape="circle" class="!h-6 !w-6 shrink-0" />
                    <Avatar v-else icon="pi pi-user" shape="circle" class="!h-6 !w-6 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
                    <div class="min-w-0 flex-1">
                      <div class="min-w-0 rounded-xl bg-stone-100 px-2.5 py-1.5 dark:bg-zinc-800">
                        <div class="truncate text-xs font-bold leading-tight text-ink-900 dark:text-white">{{ r.author.name }}</div>
                        <div class="mt-0.5 whitespace-pre-line break-words text-[13px] leading-[1.5] text-stone-700 [overflow-wrap:anywhere] dark:text-zinc-200">{{ r.content }}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 px-1 pt-0.5 text-[11px] text-stone-400">
                        <span class="shrink-0">{{ formatFlowDate(r.created_at) }}</span>
                        <button v-if="r.can_delete" class="shrink-0 px-1 py-1 active:text-red-500" @click="thread.remove(r)">Удалить</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="canComment" class="sticky bottom-0 -mx-1 mt-3 bg-white/95 pb-1 pt-2 backdrop-blur dark:bg-zinc-900/95">
            <div v-if="thread.replyTo.value" class="mb-2 flex min-w-0 items-center gap-2 rounded-full bg-violet-50 py-1.5 pl-3 pr-1.5 text-xs text-stone-600 dark:bg-violet-950/50 dark:text-zinc-300">
              <i class="pi pi-reply shrink-0 text-[11px] text-violet-500" />
              <span class="min-w-0 flex-1 truncate">Ответ для <b>{{ thread.replyTo.value.author.name }}</b></span>
              <Button icon="pi pi-times" text rounded severity="secondary" class="!h-7 !w-7 shrink-0" aria-label="Отменить ответ" @click="thread.setReply(null)" />
            </div>
            <div class="flex min-w-0 items-end gap-1.5">
              <div class="min-w-0 flex-1">
                <InputText
                  ref="commentTarget"
                  v-model="thread.draft.value"
                  placeholder="Написать комментарий…"
                  enterkeyhint="send"
                  class="w-full !rounded-2xl !border-0 !bg-stone-100 !py-3 !text-[16px] !leading-snug dark:!bg-zinc-800"
                  @keyup.enter="thread.send()"
                />
              </div>
              <Button icon="pi pi-send" rounded :loading="thread.sending.value" :disabled="!thread.draft.value.trim()" class="!h-11 !w-11 shrink-0" aria-label="Отправить" @click="thread.send()" />
            </div>
          </div>
          <div v-else class="mt-2 rounded-2xl bg-stone-50 px-3 py-2 text-center text-xs text-stone-400 dark:bg-white/[0.04] dark:text-zinc-500">
            Комментировать могут только жители района
          </div>
        </div>
        <button v-else-if="post.comments_count > 0" class="mt-2 text-[13px] font-semibold text-stone-500 hover:underline" @click="toggleComments()">
          Показать комментарии ({{ post.comments_count }})
        </button>
        <PostShareDialog :sharer="(sharer as any)" />
      </article>
    </template>
  </Card>
</template>
