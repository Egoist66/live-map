import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useFlowStore } from '@/stores/flow'
import { flowApi } from '@/services/flow.api'
import type { FlowFilter } from '@/types/flow'

/**
 * Лента UFlow: фильтр, поиск, пагинация, лайки, удаление.
 *
 * Тонкий хук над pinia-стором: сам стор хранит посты,
 * хук держит UI-состояние вкладок и подтверждение удаления.
 *
 * @example
 * const feed = useFlowFeed()
 * await feed.init()
 */
export function useFlowFeed(options?: { authorId?: number | null; postId?: number | null }) {
  const store = useFlowStore()
  const pendingDeleteId = ref<number | null>(null)
  const likeBusy = ref<Record<number, boolean>>({})

  const me = computed(() => (usePage().props.auth as { user?: { id: number; effective_plan?: string } }).user)
  const isPro = computed(() => {
    const plan = (me.value as { effective_plan?: string })?.effective_plan ?? ''
    return plan === 'pro' || plan === 'business'
  })

  const tabs = computed(() => [
    { value: 'all' as FlowFilter, label: 'Все' },
    { value: 'subscriptions' as FlowFilter, label: 'Подписки' },
    { value: 'mine' as FlowFilter, label: 'Мои' },
  ])

  /**
   * Первичная загрузка: один пост по сегменту /flow/post/ID
   * или лента (диплинк ?author= из профилей).
   * Явные опции важнее параметров URL.
   */
  async function init(): Promise<void> {
    const url = new URL(window.location.href)
    const authorParam = url.searchParams.get('author')
    const authorFromUrl = authorParam ? Number(authorParam) : null
    const resolvedAuthor = options?.authorId ?? (Number.isFinite(authorFromUrl) && authorFromUrl ? authorFromUrl : null)
    const postId = options?.postId ?? null
    const hasPostLink = !!postId
    await store.load({
      filter: hasPostLink || options?.authorId || resolvedAuthor ? 'all' : store.filter,
      authorId: hasPostLink ? null : resolvedAuthor,
      postId: postId ?? undefined,
    })
  }

  /**
   * Сменить вкладку ленты.
   * @param next новая вкладка
   */
  async function setFilter(next: FlowFilter): Promise<void> {
    await store.load({ filter: next, authorId: options?.authorId ?? null })
  }

  /**
   * Поиск по тексту с дебаунсом на стороне вызывателя.
   * @param term строка поиска
   */
  async function setSearch(term: string): Promise<void> {
    await store.load({ filter: store.filter, authorId: options?.authorId ?? null, search: term })
  }

  /**
   * Лайк / анлайк без перезагрузки.
   * @param postId пост
   */
  async function toggleLike(postId: number): Promise<void> {
    if (likeBusy.value[postId]) return
    likeBusy.value = { ...likeBusy.value, [postId]: true }
    try {
      const res = await flowApi.toggleLike(postId)
      store.applyLike(postId, res.liked, res.likes_count)
    } finally {
      const next = { ...likeBusy.value }
      delete next[postId]
      likeBusy.value = next
    }
  }

  /**
   * Открыть подтверждение удаления.
   * @param postId пост
   */
  function askDelete(postId: number): void {
    pendingDeleteId.value = postId
  }

  /**
   * Подтвердить удаление.
   */
  async function confirmDelete(): Promise<void> {
    const id = pendingDeleteId.value
    if (!id) return
    pendingDeleteId.value = null
    await flowApi.remove(id)
    store.removePost(id)
  }

  /**
   * Сбросить фильтр автора (диплинк ?author=) и вернуться ко всей ленте.
   */
  async function clearAuthor(): Promise<void> {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('author')
      window.history.replaceState({}, '', url.toString())
    } catch {}
    await store.load({ filter: 'all', authorId: null, search: '' })
  }

  return { store, tabs, pendingDeleteId, likeBusy, isPro, me, init, setFilter, setSearch, toggleLike, askDelete, confirmDelete, clearAuthor }
}
