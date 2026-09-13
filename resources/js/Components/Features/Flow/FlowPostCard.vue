<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { useFlowComments } from '@/composables/useFlowComments'
import { useLikersPreview } from '@/composables/useLikersPreview'
import LikersDialog from '@/Components/Features/Feedback/LikersDialog.vue'
import { formatFlowDate } from '@/utils/flowDate'
import type { FlowComment, FlowPost } from '@/types/flow'

const props = defineProps<{ post: FlowPost; likeBusy?: boolean }>()

const emit = defineEmits<{
  (e: 'like', id: number): void
  (e: 'edit', post: FlowPost): void
  (e: 'delete', id: number): void
}>()

const expanded = ref(false)
const thread = useFlowComments(props.post.id)
const postLikers = useLikersPreview(
  'flow',
  () => props.post?.id ?? null,
  () => props.post?.likes_count ?? 0,
)
const sharing = ref(false)
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null
  }
})()
const commentsOpened = computed(() => expanded.value)

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

        <h3 v-if="post.title" class="mt-3 text-[17px] font-black leading-snug tracking-tight text-ink-900 dark:text-white break-words">{{ post.title }}</h3>
        <p class="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-900 dark:text-zinc-100" :class="!post.title && 'mt-3'">{{ post.body }}</p>
        <div v-if="post.image_url" class="mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-800">
          <img :src="post.image_url" alt="Фото поста" loading="lazy" class="max-h-[420px] w-full object-cover" />
        </div>

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
          <span class="flex-1" />
          <Button icon="pi pi-share-alt" text rounded severity="secondary" :loading="sharing" @click="share()" />
        </div>

        <div v-if="expanded" class="mt-2 border-t border-stone-100 dark:border-zinc-800 pt-3">
          <div v-if="thread.loading.value" class="py-4 text-center text-sm text-stone-400">Загружаем комментарии…</div>
          <div v-else-if="!thread.comments.value.length" class="py-4 text-center text-sm text-stone-400">Пока тихо — станьте первым.</div>
          <div v-else class="space-y-3">
            <div v-for="c in thread.comments.value" :key="c.id" class="flex min-w-0 gap-2.5">
              <Avatar v-if="c.author.avatar_url" :image="c.author.avatar_url" shape="circle" class="!w-8 !h-8 shrink-0" />
              <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-8 !h-8 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
              <div class="min-w-0 flex-1">
                <div class="min-w-0 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2">
                  <div class="truncate text-[13px] font-bold leading-tight text-ink-900 dark:text-white">{{ replyName(c) }}</div>
                  <div class="mt-0.5 whitespace-pre-line break-words text-[14px] leading-[1.5] text-stone-700 dark:text-zinc-200 [overflow-wrap:anywhere]">{{ c.content }}</div>
                </div>
                <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pt-1 text-xs text-stone-400">
                  <span class="shrink-0">{{ formatFlowDate(c.created_at) }}</span>
                  <button class="shrink-0 px-1 py-1.5 font-semibold text-stone-500 dark:text-zinc-400 active:text-violet-600" @click="thread.setReply(c)">Ответить</button>
                  <button v-if="c.can_delete" class="shrink-0 px-1 py-1.5 active:text-red-500" @click="thread.remove(c)">Удалить</button>
                </div>
                <div v-if="c.replies?.length" class="mt-1.5 space-y-2.5 border-l-2 border-stone-200 pl-2.5 dark:border-zinc-700">
                  <div v-for="r in c.replies" :key="r.id" class="flex min-w-0 gap-2">
                    <Avatar v-if="r.author.avatar_url" :image="r.author.avatar_url" shape="circle" class="!w-6 !h-6 shrink-0" />
                    <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-6 !h-6 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
                    <div class="min-w-0 flex-1">
                      <div class="min-w-0 rounded-xl bg-stone-100 px-2.5 py-1.5 dark:bg-zinc-800">
                        <div class="truncate text-xs font-bold leading-tight text-ink-900 dark:text-white">{{ replyName(r) }}</div>
                        <div class="mt-0.5 whitespace-pre-line break-words text-[13px] leading-[1.5] text-stone-700 dark:text-zinc-200 [overflow-wrap:anywhere]">{{ r.content }}</div>
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

          <div class="sticky bottom-0 -mx-1 mt-3 bg-white/95 pb-1 pt-2 backdrop-blur dark:bg-zinc-900/95">
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
        </div>
        <button v-else-if="post.comments_count > 0" class="mt-2 text-[13px] font-semibold text-stone-500 hover:underline" @click="toggleComments()">
          Показать комментарии ({{ post.comments_count }})
        </button>
        <LikersDialog :visible="postLikers.opened.value" @update:visible="(v:boolean)=>{ v ? postLikers.open() : postLikers.close() }" title="Лайки" :likers="postLikers.likers.value" :loading="postLikers.loading.value" :total="postLikers.total.value" />
      </article>
    </template>
  </Card>
</template>
