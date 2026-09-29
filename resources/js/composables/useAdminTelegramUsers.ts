import { ref } from 'vue'
import { api } from '@/services/api'

/**
 * Строка виджета «Пользователи из Telegram».
 */
export interface AdminTelegramUser {
  id: number
  name: string
  email: string
  avatar_path: string | null
  avatar_url: string | null
  telegram_id: string | null
  telegram_username: string | null
  telegram_photo_url: string | null
  telegram_linked_at: string | null
  is_online: boolean
  last_seen_at: string | null
  created_at: string | null
}

/**
 * Виджет «Пользователи из Telegram» панели модерации.
 *
 * Все, кто пришёл из Telegram (telegram_id привязан): никнеймы
 * и TG-id, онлайн-статус. Только чтение — действий над строкой нет.
 * Поиск с дебаунсом, пагинация через PrimeVue Paginator.
 *
 * @example
 * ```ts
 * const tg = useAdminTelegramUsers()
 * await tg.load()
 * ```
 *
 * @returns список, мета, поиск и загрузка
 */
export function useAdminTelegramUsers() {
  const items = ref<AdminTelegramUser[]>([])
  const total = ref(0)
  const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const query = ref('')
  const page = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Загрузить страницу TG-пользователей.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/api/admin/telegram-users', {
        params: { q: query.value.trim() || undefined, per_page: 20, page: page.value },
      })
      items.value = Array.isArray(data?.data) ? data.data : []
      total.value = Number(data?.stats?.total ?? data?.total ?? 0)
      meta.value = {
        current_page: Number(data?.current_page ?? 1),
        last_page: Number(data?.last_page ?? 1),
        per_page: Number(data?.per_page ?? 20),
        total: Number(data?.total ?? 0),
      }
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message
      error.value = typeof message === 'string' && message !== '' ? message : 'Не удалось загрузить TG-пользователей'
    } finally {
      loading.value = false
    }
  }

  /**
   * Поиск с дебаунсом 400мс, страница сбрасывается на первую.
   *
   * @param v текст поиска (имя, email, @username, TG-id)
   */
  function setQuery(v: string): void {
    query.value = v
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      page.value = 1
      void load()
    }, 400)
  }

  /**
   * Перейти на страницу.
   *
   * @param v номер страницы (1-based)
   */
  function setPage(v: number): void {
    page.value = Math.max(1, v)
    void load()
  }

  return { items, total, meta, query, page, loading, error, load, setQuery, setPage }
}
