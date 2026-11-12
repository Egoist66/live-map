import { defineStore } from 'pinia'
import { ref } from 'vue'
import { pipeApi } from '@/services/pipe.api'
import { busOn } from '@/services/realtime-bus'
import { currentAuthUid } from '@/composables/useAuthUid'
import { useOfflineCacheStore } from '@/stores/offlineCache'
import {
  loadCachedFeed,
  loadCachedThread,
  patchCachedThread,
  patchCachedThreadFields,
  prunePipeThreads,
  prependCachedThread,
  removeCachedThread,
  saveFeed,
} from '@/composables/usePipeCache'
import { isNotFoundError } from '@/utils/httpError'
import type { PipeFilter, PipeReply, PipeThread } from '@/types/pipe'

let realtimeBound = false
const refreshingThreadIds = new Set<number>()
const threadChangedListeners = new Set<() => void>()

/**
 * Треды, удалённые локально (своё удаление или 404 с другого устройства).
 *
 * Защита от «воскрешения»: in-flight ответ ленты, отправленный до удаления,
 * не должен вернуть карточку обратно. Сет хранится на время жизни модуля,
 * id тредов глобально уникальны — пересечений между аккаунтами нет.
 */
const goneThreadIds = new Set<number>()

/**
 * Стор мини-приложения Pipe: треды — бизнес-сущность, живёт в pinia.
 *
 * Держит ленту (список, пагинацию, фильтры, поиск), открытый тред
 * и его ветку ответов. Счётчики лайков/ответов обновляются локально
 * и через realtime-шину (сокеты и поллинг несут один тип события).
 *
 * Лента — cache-first как в чатах: авторизованный пользователь при
 * старте мгновенно видит кеш из IndexedDB (usePipeCache), затем фоном
 * всегда идёт свежий запрос к серверу — протухнуть кеш не может.
 * Каждая мутация (лайк/закладка/правка/удаление/realtime) патчит
 * кеш, поэтому offline-снимок всегда согласован.
 *
 * @example
 * const pipe = usePipeStore()
 * await pipe.loadThreads({ filter: 'all' })
 */

/** Скоуп кеша ленты: вкладка + автор, без поиска (он транзиентен). */
function feedScope(filter: string, authorId: number | null): string {
  return `${filter}:${authorId ?? 0}`
}
export const usePipeStore = defineStore('pipe', () => {
  const threads = ref<PipeThread[]>([])
  const page = ref(1)
  const lastPage = ref(1)
  const loading = ref(false)
  const loadingMore = ref(false)
  /** Ручное обновление (кнопка-стрелка): крутит иконку и блокирует дубли. */
  const refreshing = ref(false)
  const filter = ref<PipeFilter>('all')
  const search = ref('')
  const authorId = ref<number | null>(null)

  /** Открытый тред и его ветка ответов (страница /thread/{id}). */
  const currentThread = ref<PipeThread | null>(null)
  const replies = ref<PipeReply[]>([])
  const repliesPage = ref(1)
  const repliesLastPage = ref(1)
  const repliesLoading = ref(false)
  const repliesLoadingMore = ref(false)

  /** Защита от гонок фоновых ревалидаций: ответы старых запросов игнорируются. */
  let feedRequestId = 0

  /** Есть ли ещё страницы ленты. */
  function hasMoreThreads(): boolean {
    return page.value < lastPage.value
  }

  /** Есть ли ещё страницы ответов. */
  function hasMoreReplies(): boolean {
    return repliesPage.value < repliesLastPage.value
  }

  /**
   * Загрузить первую страницу ленты (stale-while-revalidate).
   *
   * Авторизованному и без поиска: мгновенный рендер из IndexedDB,
   * затем **всегда** фоновая ревалидация с сервера — даже если кеш
   * помечен свежим. Так удаление/правка с другого устройства не
   * застревает в локальном снимке до истечения TTL.
   *
   * @param query фильтр, автор, поиск, диплинк-тред, ручной force-режим
   * @returns true, если ответ сервера получен и применён
   */
  async function loadThreads(query?: {
    filter?: PipeFilter
    authorId?: number | null
    search?: string
    threadId?: number | null
    force?: boolean
    background?: boolean
  }): Promise<boolean> {
    if (query?.filter) filter.value = query.filter
    if (query && 'authorId' in query) authorId.value = query.authorId ?? null
    if (query && 'search' in query) search.value = query.search ?? ''

    const requestId = ++feedRequestId
    const uid = currentAuthUid()
    const cacheStore = useOfflineCacheStore()
    const scope = feedScope(filter.value, authorId.value)
    const cacheScope = `pipe:feed:${scope}`
    const searchTerm = search.value.trim()
    const cacheable = searchTerm === ''
    const isForce = query?.force === true
    const isBackground = query?.background === true

    let paintedFromCache = false

    if (cacheable && uid > 0 && !isForce) {
      const cached = await loadCachedFeed(uid, scope)
      const cacheStillCurrent = requestId === feedRequestId
      if (cacheStillCurrent && cached && cached.threads.length > 0) {
        threads.value = cached.threads.filter((thread) => !goneThreadIds.has(thread.id))
        page.value = cached.page
        lastPage.value = cached.lastPage
        paintedFromCache = true
      }
    }

    if (!paintedFromCache && !isBackground) loading.value = true
    if (cacheable && uid > 0) cacheStore.markSyncing(cacheScope)

    try {
      /**
       * Фоновая ревалидация не должна сбрасывать докрученную ленту на
       * первую страницу: перезапрашиваем все уже загруженные страницы
       * и собираем их заново (ручное обновление работает так же).
       */
      const pagesToLoad = isBackground ? Math.max(1, page.value) : 1
      const responses = await Promise.all(
        Array.from({ length: pagesToLoad }, (_, index) =>
          pipeApi.feed({
            filter: filter.value,
            author_id: authorId.value,
            search: searchTerm || undefined,
            thread_id: query?.threadId ?? undefined,
            page: index + 1,
          }),
        ),
      )
      if (requestId !== feedRequestId) return false

      const firstPage = responses[0]
      const seenIds = new Set<number>()
      const freshThreads: PipeThread[] = []

      for (const response of responses) {
        for (const thread of response.data) {
          const isGone = goneThreadIds.has(thread.id)
          const isDuplicate = seenIds.has(thread.id)
          if (isGone || isDuplicate) continue

          seenIds.add(thread.id)
          freshThreads.push(thread)
        }
      }

      threads.value = freshThreads
      page.value = Math.min(pagesToLoad, firstPage.last_page)
      lastPage.value = firstPage.last_page

      if (cacheable && uid > 0) {
        await saveFeed(uid, scope, freshThreads, page.value, firstPage.last_page)
        void prunePipeThreads(uid)
        cacheStore.markSynced(cacheScope)
      }

      return true
    } catch {
      if (cacheable && uid > 0) cacheStore.markSyncFailed(cacheScope)
      return false
    } finally {
      if (requestId === feedRequestId) loading.value = false
    }
  }

  /** Догрузить следующую страницу ленты (снапшот кеша дотягивается до накопленной выдачи). */
  async function loadMoreThreads(): Promise<void> {
    if (loadingMore.value || loading.value) return
    if (!hasMoreThreads()) return

    const uid = currentAuthUid()
    const scope = feedScope(filter.value, authorId.value)
    const cacheable = search.value.trim() === ''

    loadingMore.value = true
    try {
      const res = await pipeApi.feed({
        filter: filter.value,
        author_id: authorId.value,
        search: search.value || undefined,
        page: page.value + 1,
      })
      const freshThreads = res.data.filter((thread) => !goneThreadIds.has(thread.id))
      threads.value = [...threads.value, ...freshThreads]
      page.value = res.current_page
      lastPage.value = res.last_page

      if (cacheable && uid > 0) {
        await saveFeed(uid, scope, threads.value, res.current_page, res.last_page)
        void prunePipeThreads(uid)
      }
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Загрузить тред с десктопа: карточка сверху, ответы ниже.
   *
   * Карточка — cache-first, но сеть дёргается всегда (фоновая
   * ревалидация). Если тред уже удалён на сервере — убираем его
   * из стора и кеша без ошибки на экране.
   *
   * @param threadId тред
   * @param options force — пропустить кеш, background — без скелетона
   * @returns true, если удалось получить свежие данные
   */
  async function loadThread(threadId: number, options?: { force?: boolean; background?: boolean }): Promise<boolean> {
    const uid = currentAuthUid()
    const cacheStore = useOfflineCacheStore()
    const threadCacheScope = `pipe:thread:${threadId}`
    const isForce = options?.force === true
    const isBackground = options?.background === true

    let paintedFromCache = false

    if (uid > 0 && !isForce) {
      const cached = await loadCachedThread(uid, threadId)
      const isGone = goneThreadIds.has(threadId)
      if (cached && !isGone) {
        currentThread.value = cached
        paintedFromCache = true
      }
    }

    if (!paintedFromCache && !isBackground) repliesLoading.value = true
    if (uid > 0) cacheStore.markSyncing(threadCacheScope)

    try {
      const [threadLoaded, repliesLoaded] = await Promise.all([
        pipeApi.show(threadId),
        pipeApi.replies(threadId, 1),
      ])
      currentThread.value = threadLoaded
      replies.value = repliesLoaded.data
      repliesPage.value = repliesLoaded.current_page
      repliesLastPage.value = repliesLoaded.last_page

      if (uid > 0) {
        await patchCachedThread(uid, threadLoaded)
        cacheStore.markSynced(threadCacheScope)
      }

      return true
    } catch (error) {
      if (isNotFoundError(error)) removeThread(threadId)
      if (uid > 0) cacheStore.markSyncFailed(threadCacheScope)
      return false
    } finally {
      repliesLoading.value = false
    }
  }

  /** Добрать следующую страницу ответов. */
  async function loadMoreReplies(): Promise<void> {
    if (!currentThread.value || repliesLoadingMore.value) return
    if (!hasMoreReplies()) return

    repliesLoadingMore.value = true
    try {
      const res = await pipeApi.replies(currentThread.value.id, repliesPage.value + 1)
      replies.value = [...replies.value, ...res.data]
      repliesPage.value = res.current_page
      repliesLastPage.value = res.last_page
    } finally {
      repliesLoadingMore.value = false
    }
  }

  /**
   * Ручное обновление всех данных Pipe: текущая лента + открытый тред
   * с ответами. Сеть тянется принудительно, кеш-снимок перезаписывается.
   *
   * Используется кнопкой-стрелкой в шапке; фоновая ревалидация при этом
   * продолжает работать штатно (фокус вкладки, открытие страницы).
   *
   * @returns true, если хотя бы одна часть данных обновилась
   */
  async function refreshAll(): Promise<boolean> {
    if (refreshing.value) return false

    refreshing.value = true
    try {
      const openThreadId = currentThread.value?.id ?? null
      const results = await Promise.all([
        loadThreads({
          filter: filter.value,
          authorId: authorId.value,
          search: search.value,
          force: true,
          background: true,
        }),
        openThreadId
          ? loadThread(openThreadId, { force: true, background: true })
          : Promise.resolve(false),
      ])

      return results.some(Boolean)
    } finally {
      refreshing.value = false
    }
  }

  /** Свежий тред наверх после создания (кеш: строка + снапшоты лент). */
  function prependThread(thread: PipeThread): void {
    const without = threads.value.filter((item) => item.id !== thread.id)
    threads.value = [thread, ...without]
    const uid = currentAuthUid()
    if (uid > 0) void prependCachedThread(uid, thread)
  }

  /** Заменить тред после редактирования плашмя (кеш патчится тем же объектом). */
  function replaceThread(thread: PipeThread): void {
    threads.value = threads.value.map((item) => (item.id === thread.id ? thread : item))
    if (currentThread.value?.id === thread.id) currentThread.value = thread
    const uid = currentAuthUid()
    if (uid > 0) void patchCachedThread(uid, thread)
  }

  /**
   * Убрать карточку только из текущей выдачи (тред жив).
   *
   * Нужно, например, когда на вкладке «Избранные» сняли закладку:
   * карточка уходит из списка, но тред остаётся в кеше и в других
   * лентах. Tombstone и удаление из IndexedDB не применяются.
   *
   * @param id тред
   */
  function dropThreadFromFeed(id: number): void {
    threads.value = threads.value.filter((item) => item.id !== id)
  }

  /**
   * Убрать тред после удаления (и из offline-снапшотов лент).
   *
   * Id попадает в gone-набор, чтобы запоздавший ответ ревалидации
   * не вернул удалённую карточку обратно в ленту.
   *
   * @param id тред
   */
  function removeThread(id: number): void {
    goneThreadIds.add(id)
    threads.value = threads.value.filter((item) => item.id !== id)
    if (currentThread.value?.id === id) currentThread.value = null
    const uid = currentAuthUid()
    if (uid > 0) void removeCachedThread(uid, id)
  }

  /**
   * Локальный лайк треда без перезагрузки.
   * @param id тред
   * @param liked состояние
   * @param likesCount счётчик
   */
  function applyLike(id: number, liked: boolean, likesCount: number): void {
    for (const target of [currentThread.value, ...threads.value]) {
      if (target && target.id === id) {
        target.liked = liked
        target.likes_count = likesCount
      }
    }
    const uid = currentAuthUid()
    if (uid > 0) void patchCachedThreadFields(uid, id, { liked, likes_count: likesCount })
  }

  /**
   * Локальная закладка треда (избранное) без перезагрузки.
   * @param id тред
   * @param saved состояние
   */
  function applySaved(id: number, saved: boolean): void {
    for (const target of [currentThread.value, ...threads.value]) {
      if (target && target.id === id) {
        target.saved = saved
      }
    }
    const uid = currentAuthUid()
    if (uid > 0) void patchCachedThreadFields(uid, id, { saved })
  }

  /**
   * Локальный лайк ответа: рекурсивный проход по ветке.
   * @param replyId ответ
   * @param liked состояние
   * @param likesCount счётчик
   */
  function applyReplyLike(replyId: number, liked: boolean, likesCount: number): void {
    const walk = (list: PipeReply[]): boolean => {
      for (const reply of list) {
        if (reply.id === replyId) {
          reply.liked = liked
          reply.likes_count = likesCount
          return true
        }
        if (reply.replies?.length && walk(reply.replies)) return true
      }
      return false
    }

    walk(replies.value)
  }

  /**
   * Локальная правка текста ответа: заменяем тело, сохраняем
   * локально подгруженные вложенные ответы (сервер их не отдаёт).
   * @param replyId ответ
   * @param updated сериализованный ответ с сервера
   */
  function applyReplyEdit(replyId: number, updated: PipeReply): void {
    const walk = (list: PipeReply[]): boolean => {
      for (let i = 0; i < list.length; i += 1) {
        const reply = list[i]
        if (reply.id === replyId) {
          list[i] = { ...updated, replies: reply.replies ?? [], replies_count: reply.replies_count ?? 0 }
          return true
        }
        if (reply.replies?.length && walk(reply.replies)) return true
      }
      return false
    }

    walk(replies.value)
  }

  /**
   * Локальный пин ответа: рекурсивный проход по ветке (флаг
   * is_pinned; порядок пересобирается при перезагрузке ветки).
   * @param replyId ответ
   * @param pinned состояние
   */
  function applyReplyPin(replyId: number, pinned: boolean): void {
    const walk = (list: PipeReply[]): boolean => {
      for (const reply of list) {
        if (reply.id === replyId) {
          reply.is_pinned = pinned
          return true
        }
        if (reply.replies?.length && walk(reply.replies)) return true
      }
      return false
    }

    walk(replies.value)
  }

  /**
   * Прибавить счётчик ответов треда (свой ответ / realtime).
   * @param threadId тред
   * @param delta +1 / -1
   */
  function applyRepliesDelta(threadId: number, delta: number): void {
    for (const target of [currentThread.value, ...threads.value]) {
      if (target && target.id === threadId) {
        target.replies_count = Math.max(0, target.replies_count + delta)
      }
    }
    const uid = currentAuthUid()
    const updated = [currentThread.value, ...threads.value].find((item) => item?.id === threadId)
    if (uid > 0 && updated) {
      void patchCachedThreadFields(uid, threadId, { replies_count: updated.replies_count })
    }
  }

  /**
   * Добавить ответ верхнего уровня в открытый тред.
   * @param reply созданный ответ
   */
  function prependReply(reply: PipeReply): void {
    if (reply.parent_id) return
    const exists = replies.value.some((item) => item.id === reply.id)
    if (!exists) replies.value = [...replies.value, reply]
  }

  /**
   * Добавить вложенный ответ к родителю (ветка рисуется на любую глубину).
   * @param reply созданный ответ
   */
  function prependNestedReply(reply: PipeReply): void {
    if (!reply.parent_id) return

    const attach = (list: PipeReply[]): boolean => {
      for (const item of list) {
        if (item.id === reply.parent_id) {
          item.replies = [...(item.replies ?? []), reply]
          item.replies_count = (item.replies_count ?? 0) + 1
          return true
        }
        if (item.replies?.length && attach(item.replies)) return true
      }
      return false
    }

    attach(replies.value)
  }

  /** Убрать ответ из открытого треда (своё удаление). */
  function removeReplyLocally(replyId: number): void {
    const strip = (list: PipeReply[]): PipeReply[] =>
      list
        .filter((item) => item.id !== replyId)
        .map((item) => ({ ...item, replies: item.replies?.length ? strip(item.replies) : item.replies }))

    replies.value = strip(replies.value)
  }

  /**
   * Освежить тред с сервера (лайки/счётчики/модерация).
   * Удалённый тред тихо уходит из ленты и кеша.
   *
   * @param threadId тред
   * @returns true, если тред получен и применён
   */
  async function refreshThread(threadId: number): Promise<boolean> {
    if (refreshingThreadIds.has(threadId)) return false

    refreshingThreadIds.add(threadId)
    try {
      const fresh = await pipeApi.show(threadId)
      replaceThread(fresh)
      return true
    } catch (error) {
      if (isNotFoundError(error)) removeThread(threadId)
      return false
    } finally {
      refreshingThreadIds.delete(threadId)
    }
  }

  /**
   * Перезагрузить ветку открытого треда (realtime thread:updated).
   */
  async function reloadReplies(): Promise<void> {
    if (!currentThread.value) return
    await loadThread(currentThread.value.id)
  }

  /**
   * Живая лента: чужие ответы/лайки из шины обновляют карточки
   * и пересобирают открытый тред. Работает и на сокетах, и в
   * polling-режиме. Идемпотентно; каждый колбэк страницы
   * добавляется в набор, шина биндится один раз.
   */
  function subscribeRealtime(onOpenThreadChanged?: () => void): void {
    if (onOpenThreadChanged) threadChangedListeners.add(onOpenThreadChanged)
    if (realtimeBound) return
    realtimeBound = true

    try {
      busOn('thread:updated', (e: unknown) => {
        const payload = e as { kind?: string; id?: number }
        if (payload?.kind !== 'pipe' || !payload.id) return

        const threadId = Number(payload.id)
        const inFeed = threads.value.some((item) => item.id === threadId)

        if (inFeed) void refreshThread(threadId)
        if (currentThread.value?.id === threadId) {
          for (const listener of threadChangedListeners) listener()
        }
      })
    } catch { /* шина недоступна — лента работает вручную */ }

    try {
      busOn('user:notification.created', (e: unknown) => {
        const activity = (e as { notification?: { data?: { activity?: Record<string, any> } } })?.notification?.data?.activity
        if (!activity) return

        const kind = String(activity.kind ?? '')
        const thread = activity.pipe_thread as { id?: number; thread_id?: number } | undefined
        const threadId = Number(thread?.id ?? thread?.thread_id ?? activity.pipe_thread_id ?? 0)

        if (kind === 'pipe_like' && threadId) {
          const count = Number(activity.count ?? 0)
          if (count) applyLike(threadId, true, count)
          return
        }

        if (kind === 'pipe_reply' && threadId) {
          applyRepliesDelta(threadId, 1)
        }
      })
    } catch { /* realtime не критичен для счётчиков */ }
  }

  return {
    threads, page, lastPage, loading, loadingMore, refreshing, filter, search, authorId,
    currentThread, replies, repliesPage, repliesLastPage, repliesLoading, repliesLoadingMore,
    hasMoreThreads, hasMoreReplies, loadThreads, loadMoreThreads, loadThread, loadMoreReplies,
    refreshAll,
    prependThread, replaceThread, removeThread, dropThreadFromFeed, applyLike, applySaved, applyReplyLike, applyReplyPin, applyReplyEdit, applyRepliesDelta,
    prependReply, prependNestedReply, removeReplyLocally, refreshThread, reloadReplies, subscribeRealtime,
  }
})
