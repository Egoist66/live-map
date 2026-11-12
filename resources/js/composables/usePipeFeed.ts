import { computed, ref, watch } from 'vue'
import { useDocumentVisibility, useWindowFocus } from '@vueuse/core'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { usePipeStore } from '@/stores/pipe'
import { pipeApi } from '@/services/pipe.api'
import { useContentModeration } from '@/composables/useContentModeration'
import { usePipeApp } from '@/composables/usePipeApp'
import { captureAuthUid } from '@/composables/useAuthUid'
import { isNotFoundError } from '@/utils/httpError'
import type { PipeFilter, PipeThread } from '@/types/pipe'

export const PIPE_THREAD_MAX = 500

/** Сколько мс играет анимация исчезновения карточки после ответа бэка. */
const REMOVE_LEAVE_MS = 500

/**
 * Пауза в виде промиса — чтобы успела проиграться анимация ухода карточки.
 *
 * @param ms длительность паузы
 */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Лента Pipes: фильтры, поиск, пагинация, лайки, создание/правка,
 * удаление и жалобы.
 *
 * Тонкий хук над pinia-стором — сущности живут там, здесь только
 * UI-состояние вкладок, композера и подтверждений. Гость read-only:
 * любые действия ведут на вход главного сайта (сессии общие).
 *
 * @example
 * const feed = usePipeFeed()
 * await feed.init()
 */
export function usePipeFeed(options?: { authorId?: number | null; threadId?: number | null }) {
  const store = usePipeStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const likeBusy = ref<Record<number, boolean>>({})
  const saveBusy = ref<Record<number, boolean>>({})
  const removingIds = ref<Record<number, boolean>>({})
  const saving = ref(false)
  const editing = ref<PipeThread | null>(null)
  const editText = ref('')

  captureAuthUid()

  const me = computed(() => (usePage().props.auth as { user?: { id: number } }).user)
  const isGuest = computed(() => !me.value)
  const { mainHref, visitMain } = usePipeApp()

  /** Лента первично загружена: ревалидация по фокусу не гонит лишний запрос. */
  const feedReady = ref(false)

  /** Не чаще раза в 15 секунд: возврат из фона не должен спамить сеть. */
  const ACTIVE_RESYNC_MS = 15_000
  let lastActiveResyncAt = 0

  const documentVisibility = useDocumentVisibility()
  const windowFocused = useWindowFocus()

  /**
   * Тихая ревалидация при возврате к вкладке/приложению.
   *
   * Другое устройство могло удалить/изменить pipes, пока вкладка была
   * в фоне — при возврате показываем актуальную ленту без скелетона.
   */
  function revalidateWhenActive(): void {
    if (!feedReady.value || store.refreshing) return

    const now = Date.now()
    const isTooSoon = now - lastActiveResyncAt < ACTIVE_RESYNC_MS
    if (isTooSoon) return

    lastActiveResyncAt = now
    void store.loadThreads({
      filter: store.filter,
      authorId: store.authorId,
      search: store.search,
      background: true,
    })
  }

  watch(documentVisibility, (state) => {
    if (state === 'visible') revalidateWhenActive()
  })

  watch(windowFocused, (isFocused) => {
    if (isFocused) revalidateWhenActive()
  })

  /** Осталось символов при правке pipe. */
  const editLeft = computed(() => PIPE_THREAD_MAX - editText.value.length)

  /** Вкладки ленты: все / мои / избранные. Подписок в Pipe больше нет. */
  const tabs = computed(() => [
    { value: 'all' as PipeFilter, label: 'Все' },
    { value: 'mine' as PipeFilter, label: 'Мои' },
    { value: 'saved' as PipeFilter, label: 'Избранные' },
  ])

  /** Причины жалоб (совпадают с бэком). */
  const reportReasons = [
    { label: 'Спам', value: 'spam' },
    { label: 'Оскорбления', value: 'abuse' },
    { label: 'Неприемлемый контент', value: 'inappropriate' },
    { label: 'Нарушение закона', value: 'illegal' },
    { label: 'Фейк / недостоверно', value: 'fake' },
  ]

  /**
   * Первичная загрузка: диплинк на тред? / лента целиком.
   * Явные опции важнее параметров URL.
   */
  async function init(): Promise<void> {
    const url = new URL(window.location.href)
    const authorParam = url.searchParams.get('author')
    const authorFromUrl = authorParam ? Number(authorParam) : null
    const resolvedAuthor = options?.authorId ?? (Number.isFinite(authorFromUrl) && authorFromUrl ? authorFromUrl : null)

    store.subscribeRealtime()

    try {
      await store.loadThreads({
        filter: options?.authorId || resolvedAuthor ? 'all' : store.filter,
        authorId: resolvedAuthor,
        threadId: options?.threadId ?? null,
      })
    } finally {
      feedReady.value = true
    }
  }

  /** Сменить вкладку ленты. */
  async function setFilter(next: PipeFilter): Promise<void> {
    const isMembersOnly = next === 'mine' || next === 'saved'
    if (isMembersOnly && isGuest.value) {
      promptLogin()
      return
    }
    await store.loadThreads({ filter: next, authorId: options?.authorId ?? null })
  }

  /** Поиск с дебаунсом на стороне вызывателя. */
  async function setSearch(term: string): Promise<void> {
    await store.loadThreads({ filter: store.filter, authorId: options?.authorId ?? null, search: term })
  }

  /** Сбросить фильтр автора, вернуться ко всей ленте. */
  async function clearAuthor(): Promise<void> {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('author')
      window.history.replaceState({}, '', url.toString())
    } catch { /* URL не критичен */ }
    await store.loadThreads({ filter: 'all', authorId: null, search: '' })
  }

  /** Гостя отправляем логиниться на главный сайт (сессия общая). */
  function promptLogin(): void {
    window.location.href = mainHref('/login')
  }

  /**
   * Переход в свой профиль ULove — пункт «Профиль» мобильной навигации
   * Pipes (чтобы вернуться обратно из мини-сайта). Гость уходит на логин.
   */
  function openMyProfile(): void {
    const userId = me.value?.id
    if (!userId) return promptLogin()
    visitMain(`/users/${userId}`)
  }

  /**
   * Тред уже удалён на сервере (404): скорее всего, действие пришло
   * с устаревшей карточки другого устройства. Убираем её из ленты и
   * кеша мягко, без красного тоста «не вышло».
   *
   * @param threadId удалённый тред
   */
  function handleGoneThread(threadId: number): void {
    store.removeThread(threadId)
    toast?.add({
      severity: 'info',
      summary: 'Pipe уже удалён',
      detail: 'Убрали устаревшую карточку из ленты',
      life: 2600,
    })
  }

  /**
   * Лайк / анлайк без перезагрузки.
   * @param threadId тред
   */
  async function toggleLike(threadId: number): Promise<void> {
    if (isGuest.value) return promptLogin()
    if (likeBusy.value[threadId]) return

    likeBusy.value = { ...likeBusy.value, [threadId]: true }
    try {
      const res = await pipeApi.toggleLike(threadId)
      store.applyLike(threadId, res.liked, res.likes_count)
    } catch (error) {
      if (isNotFoundError(error)) {
        handleGoneThread(threadId)
      } else {
        toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло поставить лайк', life: 2500 })
      }
    } finally {
      const next = { ...likeBusy.value }
      delete next[threadId]
      likeBusy.value = next
    }
  }

  /**
   * Сохранить тред в избранное / убрать закладку (оптимистично).
   * На вкладке «Избранные» снятая закладка сразу уходит из выдачи.
   *
   * @param threadId тред
   */
  async function toggleSave(threadId: number): Promise<void> {
    if (isGuest.value) return promptLogin()
    if (saveBusy.value[threadId]) return

    const current = store.threads.find((item) => item.id === threadId) ?? store.currentThread
    if (!current) return

    const nextSaved = !current.saved
    saveBusy.value = { ...saveBusy.value, [threadId]: true }
    store.applySaved(threadId, nextSaved)
    if (!nextSaved && store.filter === 'saved') store.dropThreadFromFeed(threadId)

    try {
      const res = await pipeApi.toggleSave(threadId)
      if (res.saved !== nextSaved) store.applySaved(threadId, res.saved)
      toast?.add({
        severity: 'success',
        summary: res.saved ? 'В избранном' : 'Убрано из избранного',
        detail: res.saved ? 'Pipe сохранён — найдёте во вкладке «Избранные»' : undefined,
        life: 2200,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        handleGoneThread(threadId)
        return
      }

      store.applySaved(threadId, !nextSaved)
      if (nextSaved && store.filter === 'saved') await store.loadThreads({ filter: 'saved' })
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло сохранить pipe', life: 2500 })
    } finally {
      const next = { ...saveBusy.value }
      delete next[threadId]
      saveBusy.value = next
    }
  }

  /**
   * Удалить свой тред (после подтверждения confirm.require) с эффектом:
   * карточка сразу блюрится и прижимается, а после ответа бэка плавно
   * гаснет и уходит из ленты. При ошибке блюр снимается — тред остаётся.
   *
   * @param threadId тред
   */
  async function removeThread(threadId: number): Promise<void> {
    if (removingIds.value[threadId]) return

    removingIds.value = { ...removingIds.value, [threadId]: true }

    try {
      await pipeApi.remove(threadId)
      await pause(REMOVE_LEAVE_MS)
      store.removeThread(threadId)
    } catch (error) {
      if (isNotFoundError(error)) {
        handleGoneThread(threadId)
      } else {
        toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло удалить pipe', life: 2500 })
      }
    } finally {
      const stillBusy = { ...removingIds.value }
      delete stillBusy[threadId]
      removingIds.value = stillBusy
    }
  }

  /**
   * Открыть форму правки pipe.
   *
   * @param thread редактируемый pipe
   */
  function startEdit(thread: PipeThread): void {
    editing.value = thread
    editText.value = thread.body
  }

  /** Закрыть форму правки без сохранения. */
  function cancelEdit(): void {
    editing.value = null
    editText.value = ''
    saving.value = false
  }

  /**
   * Сохранить правку: модерация на фронте, бэк просит повторно.
   * Возврат true — сохранено, диалог можно закрывать.
   */
  async function saveEdit(): Promise<boolean> {
    const target = editing.value
    const text = editText.value.trim()
    const canSave = Boolean(target) && text.length > 0 && text.length <= PIPE_THREAD_MAX && !saving.value

    if (!canSave) return false

    const moderator = useContentModeration()
    const blockReason = moderator.assertPublishable(text)

    if (blockReason) {
      toast?.add({ severity: 'error', detail: blockReason, life: 3500 })
      return false
    }

    saving.value = true
    try {
      const updated = await pipeApi.update(target!.id, { body: text })
      store.replaceThread(updated)
      cancelEdit()
      toast?.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
      return true
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      const detail = message?.errors?.content?.[0] ?? message?.errors?.body?.[0] ?? message?.message ?? 'Не вышло сохранить правку'
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 4000 })
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Жалоба на тред (модераторам приходит в админку).
   * @param target тред
   * @param reason причина
   */
  async function reportThread(target: Pick<PipeThread, 'id'>, reason: string): Promise<void> {
    try {
      await pipeApi.report('pipe_thread', target.id, reason)
      toast?.add({ severity: 'success', summary: 'Жалоба отправлена', detail: 'Модераторы увидят её в администраторской очереди', life: 3000 })
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло отправить жалобу', life: 2500 })
    }
  }

  return {
    store, tabs, reportReasons, likeBusy, saveBusy, removingIds, isGuest, me, saving,
    editing, editText, editLeft,
    init, setFilter, setSearch, clearAuthor, promptLogin, openMyProfile,
    toggleLike, toggleSave, removeThread, startEdit, cancelEdit, saveEdit, reportThread,
  }
}
