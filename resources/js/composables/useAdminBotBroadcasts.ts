import { reactive } from 'vue'
import { api } from '@/services/api'
import { busOn } from '@/services/realtime-bus'

/**
 * Строка рассылки в боте для админ-статистики.
 */
export interface AdminBotBroadcast {
  id: number
  type: 'article' | 'poll'
  title: string
  body: string
  has_photo: boolean
  poll_question: string
  poll_options: string[]
  poll_multiple: boolean
  status: string
  sent_count: number
  failed_count: number
  votes_count: number
  options_count: number
  author_name: string
  published_at: string | null
  created_at: string | null
}

/**
 * Голоса по одному варианту опроса.
 */
export interface AdminBotBroadcastBreakdown {
  option: string
  votes: number
}

/**
 * Карточка рассылки с разбивкой голосов.
 */
export interface AdminBotBroadcastDetail extends AdminBotBroadcast {
  breakdown: AdminBotBroadcastBreakdown[]
}

/**
 * Виджет «Рассылки в боте» панели модерации (вкладка Telegram).
 *
 * Публикации создаются мастером /publish прямо в боте, здесь —
 * только итоги: доставка, провалы, голоса по вариантам опроса.
 * Финиш рассылки прилетает сокетом bot-broadcast.finished —
 * список и открытая карточка обновляются сами, без рефреша.
 *
 * @example
 * ```ts
 * const bb = useAdminBotBroadcasts()
 * await bb.load()
 * const off = bb.bindLive()
 * onUnmounted(() => off())
 * ```
 *
 * @returns состояние, загрузка, карточка, удаление и подписка на финиш
 */
export function useAdminBotBroadcasts() {
  const state = reactive({
    items: [] as AdminBotBroadcast[],
    total: 0,
    page: 1,
    lastPage: 1,
    perPage: 15,
    loading: false,
    error: null as string | null,
    selected: null as AdminBotBroadcastDetail | null,
    detailLoading: false,
    dialogOpen: false,
  })

  /**
   * Вытащить человеческое сообщение об ошибке из ответа API.
   *
   * @param e пойманная ошибка
   * @param fallback текст по умолчанию
   * @returns строка для показа
   */
  function errText(e: unknown, fallback: string): string {
    const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message
    return typeof message === 'string' && message !== '' ? message : fallback
  }

  /**
   * Загрузить страницу рассылок.
   */
  async function load(): Promise<void> {
    state.loading = true
    state.error = null
    try {
      const { data } = await api.get('/api/admin/bot-broadcasts', { params: { page: state.page } })
      state.items = Array.isArray(data?.data) ? data.data : []
      state.total = Number(data?.total ?? 0)
      state.page = Number(data?.current_page ?? 1)
      state.lastPage = Number(data?.last_page ?? 1)
      state.perPage = Number(data?.per_page ?? 15)
    } catch (e: unknown) {
      state.error = errText(e, 'Не удалось загрузить рассылки')
    } finally {
      state.loading = false
    }
  }

  /**
   * Перейти на страницу списка.
   *
   * @param v номер страницы (1-based)
   */
  function setPage(v: number): void {
    state.page = Math.max(1, v)
    void load()
  }

  /**
   * Открыть карточку рассылки с разбивкой голосов.
   *
   * @param id id рассылки
   */
  async function openDetail(id: number): Promise<void> {
    state.dialogOpen = true
    state.detailLoading = true
    try {
      const { data } = await api.get(`/api/admin/bot-broadcasts/${id}`)
      state.selected = data as AdminBotBroadcastDetail
    } catch (e: unknown) {
      state.error = errText(e, 'Не удалось открыть рассылку')
      state.dialogOpen = false
    } finally {
      state.detailLoading = false
    }
  }

  /**
   * Удалить рассылку из истории (копии у пользователей остаются).
   *
   * @param id id рассылки
   */
  async function remove(id: number): Promise<void> {
    try {
      await api.delete(`/api/admin/bot-broadcasts/${id}`)
      state.items = state.items.filter((row) => row.id !== id)
      state.total = Math.max(0, state.total - 1)
      if (state.selected?.id === id) {
        state.selected = null
        state.dialogOpen = false
      }
    } catch (e: unknown) {
      state.error = errText(e, 'Не удалось удалить рассылку')
    }
  }

  /**
   * Подписаться на финиш рассылки: список и карточка обновятся сами.
   *
   * @returns отписка для onUnmounted
   */
  function bindLive(): () => void {
    return busOn('user:bot-broadcast.finished', () => {
      void load()
      if (state.selected) void openDetail(state.selected.id)
    })
  }

  return { state, load, setPage, openDetail, remove, bindLive }
}
