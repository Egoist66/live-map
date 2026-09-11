import { defineStore } from 'pinia'
import { ref } from 'vue'
import { flowApi } from '@/services/flow.api'
import type { FlowFilter, FlowPost } from '@/types/flow'

/**
 * Стор ленты UFlow: посты — бизнес-сущность, живёт в pinia.
 *
 * Хранит список, пагинацию, фильтр и поиск. Мутации счётчиков
 * прилетают сюда же, чтобы лента и профиль видели одно состояние.
 *
 * @example
 * const flow = useFlowStore()
 * await flow.load({ filter: 'all' })
 */
export const useFlowStore = defineStore('flow', () => {
  const posts = ref<FlowPost[]>([])
  const page = ref(1)
  const lastPage = ref(1)
  const loading = ref(false)
  const loadingMore = ref(false)
  const filter = ref<FlowFilter>('all')
  const search = ref('')
  const authorId = ref<number | null>(null)

  /** Есть ли ещё страницы. */
  function hasMore(): boolean {
    return page.value < lastPage.value
  }

  /**
   * Загрузить первую страницу по фильтру.
   * @param query фильтр, автор, поиск
   */
  async function load(query?: { filter?: FlowFilter; authorId?: number | null; search?: string; postId?: number | null }): Promise<void> {
    if (query?.filter) filter.value = query.filter
    if (query && 'authorId' in query) authorId.value = query.authorId ?? null
    if (query && 'search' in query) search.value = query.search ?? ''
    loading.value = true
    try {
      const res = await flowApi.feed({
        filter: filter.value,
        author_id: authorId.value,
        search: search.value || undefined,
        post_id: query?.postId ?? undefined,
        page: 1,
      })
      posts.value = res.data
      page.value = res.current_page
      lastPage.value = res.last_page
    } finally {
      loading.value = false
    }
  }

  /**
   * Догрузить следующую страницу.
   */
  async function loadMore(): Promise<void> {
    if (loadingMore.value || loading.value) return
    if (!hasMore()) return
    loadingMore.value = true
    try {
      const res = await flowApi.feed({
        filter: filter.value,
        author_id: authorId.value,
        search: search.value || undefined,
        page: page.value + 1,
      })
      posts.value = [...posts.value, ...res.data]
      page.value = res.current_page
      lastPage.value = res.last_page
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Поставить пост наверх после создания.
   * @param post новый пост
   */
  function prepend(post: FlowPost): void {
    const without = posts.value.filter((item) => item.id !== post.id)
    posts.value = [post, ...without]
  }

  /**
   * Заменить пост после редактирования.
   * @param post обновлённый пост
   */
  function replace(post: FlowPost): void {
    posts.value = posts.value.map((item) => (item.id === post.id ? post : item))
  }

  /**
   * Убрать пост после удаления.
   * @param id пост
   */
  function removePost(id: number): void {
    posts.value = posts.value.filter((item) => item.id !== id)
  }

  /**
   * Применить лайк без перезагрузки.
   * @param id пост
   * @param liked новое состояние
   * @param likesCount счётчик
   */
  function applyLike(id: number, liked: boolean, likesCount: number): void {
    const target = posts.value.find((item) => item.id === id)
    if (!target) return
    target.liked = liked
    target.likes_count = likesCount
  }

  /**
   * Применить счётчик комментариев.
   * @param id пост
   * @param delta +1 или -N
   */
  function applyCommentsDelta(id: number, delta: number): void {
    const target = posts.value.find((item) => item.id === id)
    if (!target) return
    target.comments_count = Math.max(0, target.comments_count + delta)
  }

  return { posts, page, lastPage, loading, loadingMore, filter, search, authorId, hasMore, load, loadMore, prepend, replace, removePost, applyLike, applyCommentsDelta }
})
