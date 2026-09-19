import { defineStore } from 'pinia'
import { ref } from 'vue'
import { flowApi } from '@/services/flow.api'
import { busOn } from '@/services/realtime-bus'
import type { FlowFilter, FlowPoll, FlowPost } from '@/types/flow'

let realtimeBound = false
const refreshing = new Set<number>()

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
  const tag = ref<string | null>(null)
  const authorId = ref<number | null>(null)

  /** Есть ли ещё страницы. */
  function hasMore(): boolean {
    return page.value < lastPage.value
  }

  /**
   * Загрузить первую страницу по фильтру.
   * @param query фильтр, автор, поиск, тег
   */
  async function load(query?: { filter?: FlowFilter; authorId?: number | null; search?: string; tag?: string | null; postId?: number | null }): Promise<void> {
    if (query?.filter) filter.value = query.filter
    if (query && 'authorId' in query) authorId.value = query.authorId ?? null
    if (query && 'search' in query) search.value = query.search ?? ''
    if (query && 'tag' in query) tag.value = query.tag ?? null
    loading.value = true
    try {
      const res = await flowApi.feed({
        filter: filter.value,
        author_id: authorId.value,
        search: search.value || undefined,
        tag: tag.value,
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
        tag: tag.value,
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

  /**
   * Применить свежий опрос без перезагрузки ленты.
   * @param postId пост
   * @param poll опрос с сервера
   */
  function applyPoll(postId: number, poll: FlowPoll): void {
    const target = posts.value.find((item) => item.id === postId)
    if (!target) return
    target.poll = poll
  }

  /**
   * Применить репост: счётчик и флаг у оригинала + пост наверх.
   * @param repost созданный репост
   */
  function applyRepost(repost: FlowPost): void {
    const rootId = repost.repost_of_id
    if (rootId) {
      for (const item of posts.value) {
        const itemRoot = item.repost_of_id ?? item.id
        if (itemRoot === rootId) {
          item.reposts_count += 1
          item.my_repost_id = repost.id
        }
      }
    }
    prepend(repost)
  }

  /**
   * Откатить репост: счётчик и флаг у оригинала + убрать из ленты.
   * @param repostId удалённый репост
   * @param rootId корень цепочки
   */
  function revertRepost(repostId: number, rootId: number): void {
    for (const item of posts.value) {
      const itemRoot = item.repost_of_id ?? item.id
      if (itemRoot === rootId) {
        item.reposts_count = Math.max(0, item.reposts_count - 1)
        if (item.my_repost_id === repostId) item.my_repost_id = null
      }
    }
    removePost(repostId)
  }

  /**
   * Освежить один пост с сервера (лайки, опрос, счётчики).
   * Удалённый пост тихо уходит из ленты.
   * @param postId пост
   */
  async function refreshPost(postId: number): Promise<void> {
    if (refreshing.has(postId)) return
    refreshing.add(postId)
    try {
      const fresh = await flowApi.show(postId)
      replace(fresh)
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) removePost(postId)
    } finally {
      refreshing.delete(postId)
    }
  }

  /**
   * Живая лента: чужой лайк/коммент/репост/опрос из шины
   * подтягивает свежую карточку. Работает на сокетах и поллинге —
   * оба несут user:notification.created. Идемпотентно.
   */
  function subscribeRealtime(): void {
    if (realtimeBound) return
    realtimeBound = true
    try {
      busOn('user:notification.created', (e: unknown) => {
        const activity = (e as { notification?: { data?: { activity?: { kind?: string; flow_post?: { id?: number }; flow_post_id?: number } } } })?.notification?.data?.activity
        if (!activity) return
        const postId = Number(activity.flow_post?.id ?? activity.flow_post_id ?? 0)
        if (!postId) return
        if (!posts.value.some((item) => item.id === postId)) return
        void refreshPost(postId)
      })
    } catch { /* шина недоступна — лента работает вручную */ }
  }

  return { posts, page, lastPage, loading, loadingMore, filter, search, tag, authorId, hasMore, load, loadMore, prepend, replace, removePost, applyLike, applyCommentsDelta, applyPoll, applyRepost, revertRepost, refreshPost, subscribeRealtime }
})
