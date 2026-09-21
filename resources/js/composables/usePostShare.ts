import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { chatApi } from '@/services/chat.api'
import type { SharedPostRef } from '@/types/entities/Chat'

export type ShareCandidate = {
  id: number
  name: string
  avatar_url?: string | null
  can_message?: boolean
  conversation_id?: number | null
}

type SearchRow = {
  data?: ShareCandidate[]
  has_more?: boolean
}

/**
 * Шарин post в личку: модалка «кому», выбор одного/нескольких, отправка.
 *
 * Кандидаты по умолчанию — недавние диалоги, при вводе — поиск по людям.
 * Отправка идёт одним запросом POST /api/chat/share-post, дальше чат
 * подхватит новые message через realtime-bus (MessageSent) как обычно.
 *
 * @example
 * const sharer = usePostShare()
 * sharer.open({ type: 'flow', id: post.id, title: post.title })
 */
export function usePostShare() {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const isOpen = ref(false)
  const postRef = ref<SharedPostRef | null>(null)
  const query = ref('')
  const comment = ref('')
  const candidates = ref<ShareCandidate[]>([])
  const selectedIds = ref<number[]>([])
  const loading = ref(false)
  const searching = ref(false)
  const sending = ref(false)

  const selectedCount = computed(() => selectedIds.value.length)
  const canSend = computed(() => selectedIds.value.length > 0 && !sending.value)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Открыть модалку шаринга для поста.
   * @param post тип + id + превью для шапки модалки
   */
  function open(post: SharedPostRef): void {
    postRef.value = post
    query.value = ''
    comment.value = ''
    selectedIds.value = []
    isOpen.value = true
    void loadRecent()
  }

  /**
   * Закрыть и сбросить состояние.
   */
  function close(): void {
    isOpen.value = false
    postRef.value = null
    query.value = ''
    comment.value = ''
    selectedIds.value = []
    candidates.value = []
  }

  /**
   * Недавние диалоги как кандидаты по умолчанию.
   */
  async function loadRecent(): Promise<void> {
    loading.value = true
    try {
      const rows = await chatApi.conversations(1, 20)
      const list: ShareCandidate[] = []
      const seen = new Set<number>()
      for (const conv of rows ?? []) {
        const other = (conv as { other?: ShareCandidate | null }).other
        if (!other || seen.has(other.id)) {
          continue
        }
        seen.add(other.id)
        list.push({
          id: other.id,
          name: other.name,
          avatar_url: other.avatar_url ?? null,
          can_message: other.can_message,
          conversation_id: (conv as { id: number }).id,
        })
      }
      if (query.value.trim() === '') {
        candidates.value = list
      }
    } catch {
      candidates.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Поиск людей с дебаунсом 350мс.
   * @param value строка поиска
   */
  function search(value: string): void {
    query.value = value
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    const term = value.trim()
    if (term.length < 2) {
      void loadRecent()
      return
    }
    searching.value = true
    searchTimer = setTimeout(() => {
      void runSearch(term)
    }, 350)
  }

  /**
   * Выполнить поисковый запрос.
   * @param term минимум 2 символа
   */
  async function runSearch(term: string): Promise<void> {
    try {
      const res = (await chatApi.search(term, 1, 20)) as SearchRow | ShareCandidate[]
      const rows = Array.isArray(res) ? res : (res.data ?? [])
      candidates.value = rows.map((u) => ({
        id: u.id,
        name: u.name,
        avatar_url: u.avatar_url ?? null,
        can_message: u.can_message,
      }))
    } catch {
      candidates.value = []
    } finally {
      searching.value = false
    }
  }

  /**
   * Выбрать/снять получателя.
   * @param id id пользователя
   */
  function toggle(id: number): void {
    const next = selectedIds.value.includes(id)
      ? selectedIds.value.filter((v) => v !== id)
      : [...selectedIds.value, id]
    selectedIds.value = next.slice(0, 10)
  }

  /**
   * Убрать получателя из выбранных.
   * @param id id пользователя
   */
  function remove(id: number): void {
    selectedIds.value = selectedIds.value.filter((v) => v !== id)
  }

  /**
   * Имя выбранного для чипов.
   * @param id id пользователя
   */
  function nameOf(id: number): string {
    const found = candidates.value.find((c) => c.id === id)
    return found?.name ?? 'Пользователь'
  }

  /**
   * Отправить пост выбранным получателям.
   * @returns true при успехе хотя бы одной отправки
   */
  async function send(): Promise<boolean> {
    if (!postRef.value || selectedIds.value.length === 0 || sending.value) {
      return false
    }
    sending.value = true
    try {
      const res = await chatApi.sharePost({
        user_ids: [...selectedIds.value],
        post_type: postRef.value.type,
        post_id: postRef.value.id,
        comment: comment.value.trim() !== '' ? comment.value.trim() : null,
      })
      const sentCount = res.sent?.length ?? 0
      const skippedCount = res.skipped?.length ?? 0
      if (sentCount > 0) {
        const detail = skippedCount > 0
          ? `Доставлено: ${sentCount}, пропущено: ${skippedCount}`
          : `Получателей: ${sentCount}`
        toast?.add({ severity: 'success', summary: 'Отправлено', detail, life: 3500 })
        close()
        return true
      }
      const reason = res.skipped?.[0]?.reason ?? 'Не вышло отправить'
      toast?.add({ severity: 'error', summary: 'Не отправлено', detail: reason, life: 4000 })
      return false
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не вышло отправить пост'
      toast?.add({ severity: 'error', summary: 'Не отправлено', detail, life: 4000 })
      return false
    } finally {
      sending.value = false
    }
  }

  return {
    isOpen,
    postRef,
    query,
    comment,
    candidates,
    selectedIds,
    loading,
    searching,
    sending,
    selectedCount,
    canSend,
    open,
    close,
    search,
    toggle,
    remove,
    nameOf,
    send,
  }
}
