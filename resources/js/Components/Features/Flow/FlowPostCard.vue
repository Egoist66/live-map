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
      <article class="p-4 sm:p-5">
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
            :class="post.liked ? '!text-rose-500' : '!text-stone-500 dark:!text-zinc-400'"
            :label="String(post.likes_count)"
            @click="emit('like', post.id)"
          />
          <Button icon="pi pi-comment" text rounded severity="secondary" :label="String(post.comments_count)" @click="toggleComments()" />
          <span class="flex-1" />
          <Button icon="pi pi-share-alt" text rounded severity="secondary" :loading="sharing" @click="share()" />
        </div>

        <div v-if="expanded" class="mt-2 space-y-3 border-t border-stone-100 dark:border-zinc-800 pt-3">
          <div v-if="thread.loading.value" class="text-sm text-stone-400">Загружаем комментарии…</div>
          <div v-else-if="!thread.comments.value.length" class="text-sm text-stone-400">Пока тихо — станьте первым.</div>
          <div v-for="c in thread.comments.value" :key="c.id" class="flex gap-2.5">
            <Avatar v-if="c.author.avatar_url" :image="c.author.avatar_url" shape="circle" class="!w-8 !h-8 shrink-0" />
            <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-8 !h-8 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
            <div class="min-w-0 flex-1 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2">
              <div class="text-[13px] font-bold text-ink-900 dark:text-white">{{ replyName(c) }}</div>
              <div class="whitespace-pre-line break-words text-sm text-stone-700 dark:text-zinc-200">{{ c.content }}</div>
              <div class="mt-1 flex items-center gap-3 text-xs text-stone-400">
                <span>{{ formatFlowDate(c.created_at) }}</span>
                <button class="font-semibold hover:underline" @click="thread.setReply(c)">Ответить</button>
                <button v-if="c.can_delete" class="hover:underline" @click="thread.remove(c)">Удалить</button>
              </div>
              <div v-if="c.replies?.length" class="mt-2 space-y-2">
                <div v-for="r in c.replies" :key="r.id" class="flex gap-2">
                  <Avatar v-if="r.author.avatar_url" :image="r.author.avatar_url" shape="circle" class="!w-6 !h-6 shrink-0" />
                  <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-6 !h-6 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
                  <div class="min-w-0 flex-1 rounded-xl bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                    <div class="text-xs font-bold text-ink-900 dark:text-white">{{ replyName(r) }}</div>
                    <div class="whitespace-pre-line break-words text-[13px] text-stone-700 dark:text-zinc-200">{{ r.content }}</div>
                    <div class="mt-0.5 flex gap-2 text-[11px] text-stone-400">
                      <span>{{ formatFlowDate(r.created_at) }}</span>
                      <button v-if="r.can_delete" class="hover:underline" @click="thread.remove(r)">Удалить</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <div v-if="thread.replyTo.value" class="mb-1 flex items-center gap-2 text-xs text-stone-500">
                <span>Ответ для <b>{{ replyName(thread.replyTo.value) }}</b></span>
                <button class="text-stone-400 hover:text-red-500" @click="thread.setReply(null)"><i class="pi pi-times text-[11px]" /></button>
              </div>
              <InputText
                v-model="thread.draft.value"
                placeholder="Написать комментарий…"
                class="w-full !rounded-full !bg-stone-100 dark:!bg-zinc-800 !border-0"
                @keyup.enter="thread.send()"
              />
            </div>
            <label class="hidden sm:inline-flex items-center gap-1 text-xs text-stone-400">
              <Checkbox v-model="thread.anonymousReply.value" binary /> аноним
            </label>
            <Button icon="pi pi-send" rounded :loading="thread.sending.value" :disabled="!thread.draft.value.trim()" @click="thread.send()" />
          </div>
        </div>
        <button v-else-if="post.comments_count > 0" class="mt-2 text-[13px] font-semibold text-stone-500 hover:underline" @click="toggleComments()">
          Показать комментарии ({{ post.comments_count }})
        </button>
      </article>
    </template>
  </Card>
</template>
