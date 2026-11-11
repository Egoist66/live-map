import { computed, ref } from 'vue'
import { bindThreadLive } from '@/composables/useThreadLive'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { usePipeStore } from '@/stores/pipe'
import { pipeApi } from '@/services/pipe.api'
import { useContentModeration } from '@/composables/useContentModeration'
import { usePipeApp } from '@/composables/usePipeApp'
import type { PipeReply, PipeThread } from '@/types/pipe'

export const PIPE_REPLY_MAX = 300

/**
 * Ответы треда Pipe (страница /thread/{id}).
 *
 * Загрузка ветки, отправка ответа (на тред или на ответ),
 * лайки, удаление, работающая в realtime ветка через
 * CommentThreadUpdated touch(pipe).
 *
 * @param threadIdGetter геттер id открытого треда
 * @example
 * const thread = usePipeThread(() => props.threadId)
 * await thread.load()
 */
export function usePipeThread(threadIdGetter: () => number | null) {
  const store = usePipeStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const replyBody = ref('')
  const replyParent = ref<PipeReply | null>(null)
  const replyAnonymous = ref(false)
  const sending = ref(false)
  const replyBusy = ref<Record<number, boolean>>({})
  const saveBusy = ref(false)

  const me = computed(() => (usePage().props.auth as { user?: { id: number } }).user)
  const isGuest = computed(() => !me.value)
  const { mainHref } = usePipeApp()

  /** Куда ответить: null — на сам тред. */
  const replyTo = computed(() => replyParent.value)

  /** Цитата-контекст композера: кому и на что отвечаем (глубокие ветки читаются). */
  const replyQuote = computed(() => {
    const parent = replyParent.value
    if (!parent) return null

    const excerpt = parent.body.length > 90 ? `${parent.body.slice(0, 90)}…` : parent.body
    return { authorName: parent.author?.name ?? 'Аноним', excerpt }
  })

  /** Черновик идёт конкретно на ответ. */
  function startReplyTo(reply: PipeReply | null): void {
    replyParent.value = reply
  }

  /** Осталось символов черновика. */
  const left = computed(() => PIPE_REPLY_MAX - replyBody.value.length)
  const canSend = computed(() => replyBody.value.trim().length > 0 && replyBody.value.length <= PIPE_REPLY_MAX && !sending.value)

  /**
   * Загрузить тред: карточка + первая страница ветки ответов.
   * @param threadId тред
   */
  async function load(threadId: number): Promise<void> {
    await store.loadThread(threadId)
  }

  /** Максимальный id известных локально ответов (для поллинг-тика). */
  function knownMaxReplyId(): number {
    let max = 0
    const walk = (list: PipeReply[]): void => {
      for (const reply of list) {
        max = Math.max(max, reply.id)
        if (reply.replies?.length) walk(reply.replies)
      }
    }

    walk(store.replies)
    return max
  }

  /**
   * Живое открытое тред-страница: сокет-канал threads.pipe.{id} +
   * поллинг-watch в realtime bus. Оба транспорта пинают reloadReplies.
   *
   * @returns функция отписки (для onBeforeUnmount)
   */
  function bindLive(): () => void {
    return bindThreadLive({
      kind: 'pipe',
      id: threadIdGetter,
      knownMax: knownMaxReplyId,
      onChanged: () => {
        void store.reloadReplies()
      },
    })
  }

  /**
   * Отправить ответ.
   * Возврат true — текст отправлен, композер можно чистить.
   */
  async function sendReply(): Promise<boolean> {
    const threadId = threadIdGetter()
    if (!threadId || isGuest.value || sending.value) return false

    const text = replyBody.value.trim()
    if (!text) return false

    const moderator = useContentModeration()
    const blockReason = moderator.assertPublishable(text)
    if (blockReason) {
      toast?.add({ severity: 'warn', summary: 'Модерация', detail: blockReason, life: 3500 })
      return false
    }

    sending.value = true
    try {
      const created = await pipeApi.createReply(threadId, {
        body: text,
        parent_id: replyParent.value?.id ?? null,
        is_anonymous: replyAnonymous.value,
      })

      if (created.parent_id) {
        store.prependNestedReply(created)
      } else {
        store.prependReply(created)
      }
      store.applyRepliesDelta(threadId, 1)

      replyBody.value = ''
      replyParent.value = null
      return true
    } catch (error) {
      const detail = replyErrorText(error)
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 3500 })
      return false
    } finally {
      sending.value = false
    }
  }

  /**
   * Сохранить открытый тред в избранное / убрать закладку (оптимистично).
   * Гостя ведём на логин главного сайта (сессия общая).
   */
  async function toggleThreadSave(): Promise<void> {
    const target = store.currentThread
    if (!target) return
    if (isGuest.value) {
      window.location.href = mainHref('/login')
      return
    }
    if (saveBusy.value) return

    const nextSaved = !target.saved
    saveBusy.value = true
    store.applySaved(target.id, nextSaved)

    try {
      const res = await pipeApi.toggleSave(target.id)
      if (res.saved !== nextSaved) store.applySaved(target.id, res.saved)
      toast?.add({
        severity: 'success',
        summary: res.saved ? 'В избранном' : 'Убрано из избранного',
        detail: res.saved ? 'Pipe сохранён — найдёте во вкладке «Избранные» ленты' : undefined,
        life: 2200,
      })
    } catch {
      store.applySaved(target.id, !nextSaved)
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло сохранить pipe', life: 2500 })
    } finally {
      saveBusy.value = false
    }
  }

  /**
   * Прогон дублей: лайк/анлайк ответа без перезагрузки ветки.
   * @param replyId ответ
   */
  async function toggleReplyLike(replyId: number): Promise<void> {    if (isGuest.value) return
    if (replyBusy.value[replyId]) return

    replyBusy.value = { ...replyBusy.value, [replyId]: true }
    try {
      const res = await pipeApi.toggleReplyLike(replyId)
      store.applyReplyLike(replyId, res.liked, res.likes_count)
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло поставить лайк', life: 2500 })
    } finally {
      const next = { ...replyBusy.value }
      delete next[replyId]
      replyBusy.value = next
    }
  }

  /**
   * Удалить свой ответ: счётчик треда братка на -1.
   * @param replyId ответ
   */
  async function deleteReply(replyId: number): Promise<void> {
    if (isGuest.value) return

    try {
      await pipeApi.removeReply(replyId)
      store.removeReplyLocally(replyId)

      const threadId = threadIdGetter()
      if (threadId) store.applyRepliesDelta(threadId, -1)
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло удалить ответ', life: 2500 })
    }
  }

  /**
   * Жалоба на ответ.
   * @param reply ответ
   * @param reason причина из списка
   */
  async function reportReply(reply: PipeReply, reason: string): Promise<void> {
    try {
      await pipeApi.report('pipe_reply', reply.id, reason)
      toast?.add({ severity: 'success', summary: 'Жалоба отправлена', detail: 'Модераторы проверят ответ', life: 3000 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло отправить жалобу', life: 2500 })
    }
  }

  /**
   * Жалоба на сам тред (со страницы /thread/{id}).
   * @param thread тред
   * @param reason причина
   */
  async function reportThread(thread: PipeThread, reason: string): Promise<void> {
    try {
      await pipeApi.report('pipe_thread', thread.id, reason)
      toast?.add({ severity: 'success', summary: 'Жалоба отправлена', life: 3000 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло отправить жалобу', life: 2500 })
    }
  }

  /**
   * Текст ошибки отправки (422 с текстом модерации — тоже сюда).
   */
  function replyErrorText(error: unknown): string {
    const message = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
    const first = message?.errors?.body?.[0]

    if (first) return first
    if (message?.message) return message.message
    return 'Не вышло отправить ответ'
  }

  return {
    store, me, isGuest, replyBody, replyParent, replyAnonymous, sending, replyBusy, saveBusy,
    replyTo, replyQuote, left, canSend, startReplyTo, load, bindLive, sendReply,
    toggleReplyLike, toggleThreadSave, deleteReply, reportReply, reportThread,
  }
}
