import { computed, ref, watch } from 'vue'
import { adminApi } from '@/services/admin.api'

let searchTimer: ReturnType<typeof setTimeout> | null = null

export type LoginStateKey = 'ok' | 'warning' | 'frozen' | 'banned' | 'banned_frozen'

/**
 * Мета бейджа статуса входа для админки.
 */
export interface LoginStateMeta {
  /** Ключ состояния с бэка. */
  key: LoginStateKey
  /** Человекочитаемая подпись. */
  label: string
  /** Severity для PrimeVue Tag. */
  severity: 'success' | 'warn' | 'danger' | 'secondary' | 'info' | 'contrast'
}

/**
 * Логи входов для таба «Безопасность».
 *
 * Бейдж таба — непрочитанные фейлы: открываем таб — список
 * обновляется и счётчик гаснет, новые попытки зажигают снова.
 * Разбан и ручной сброс через thaw() на бэке рвут цепочку фейлов
 * success-маркером и чистят RateLimiter, поэтому после действий
 * список перезагружается, чтобы статусы (frozen/banned) были точными.
 *
 * @returns состояние логов и действия
 * @example
 * const logins = useAdminLoginAttempts()
 * await logins.openTab()
 * await logins.resetFreeze('user@mail.com')
 */
export function useAdminLoginAttempts() {
  const items = ref<any[]>([])
  const meta = ref<any>({ total: 0, per_page: 20, current_page: 1, last_page: 1 })
  const stats = ref<{ failed_today: number; failed_unseen?: number; banned_total: number }>({ failed_today: 0, banned_total: 0 })

  /**
   * Число для бейджа таба: непрочитанное, фолбэк — объём за 24ч.
   */
  const unseenCount = computed(() => stats.value.failed_unseen ?? stats.value.failed_today)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const query = ref('')
  const filter = ref<'all' | 'failed' | 'success'>('failed')
  const page = ref(1)
  const actingId = ref<number | null>(null)
  const resettingEmail = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const d: any = await adminApi.loginAttempts({
        q: query.value.trim() || undefined,
        successful: filter.value,
        page: page.value,
      })
      items.value = d.data ?? []
      meta.value = { total: d.total ?? 0, per_page: d.per_page ?? 20, current_page: d.current_page ?? 1, last_page: d.last_page ?? 1 }
      if (d.stats) stats.value = d.stats
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить логи входов'
    } finally {
      loading.value = false
    }
  }

  function setQuery(v: string) {
    query.value = v
    page.value = 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void load(), 400)
  }

  function setFilter(v: 'all' | 'failed' | 'success') {
    filter.value = v
    page.value = 1
    void load()
  }

  function setPage(p: number) {
    page.value = p
    void load()
  }

  function applyBanState(userId: number, banned_at: string | null, banned_reason: string | null) {
    for (const a of items.value) {
      if (a.user && Number(a.user.id) === Number(userId)) {
        a.user.banned_at = banned_at
        a.user.banned_reason = banned_reason
      }
    }
  }

  async function ban(user: any, reason?: string) {
    if (!user?.id) return
    actingId.value = user.id
    error.value = null
    try {
      const d: any = await adminApi.banUser(user.id, reason)
      user.banned_at = d.banned_at ?? null
      user.banned_reason = d.banned_reason ?? null
      applyBanState(user.id, d.banned_at ?? null, d.banned_reason ?? null)
      await load()
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось заблокировать'
      throw e
    } finally {
      actingId.value = null
    }
  }

  async function unban(user: any) {
    if (!user?.id) return
    actingId.value = user.id
    error.value = null
    try {
      await adminApi.unbanUser(user.id)
      user.banned_at = null
      user.banned_reason = null
      applyBanState(user.id, null, null)
      await load()
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось разблокировать'
      throw e
    } finally {
      actingId.value = null
    }
  }

  /**
   * Сбросить заморозку и счётчик фейлов по email.
   *
   * Для «заморожен, но не забанен»: разбанивать нечего, а вход закрыт.
   * Бэк вставляет success-маркер и чистит троттлинг — вход открывается сразу.
   *
   * @param email email для разморозки
   */
  async function resetFreeze(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    resettingEmail.value = normalized
    error.value = null
    try {
      await adminApi.resetLoginAttempts(normalized)
      await load()
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось сбросить заморозку'
      throw e
    } finally {
      resettingEmail.value = null
    }
  }

  /**
   * Мета статуса входа для бейджа в списке.
   *
   * @param attempt строка попытки с полями login_state/is_frozen/is_banned/fails_consecutive
   * @returns мета для Tag: подпись и severity
   * @example
   * loginStateOf({ login_state: 'frozen', retry_mins: 42 })
   * // { key: 'frozen', label: 'заморожен · 42 мин', severity: 'warn' }
   */
  function loginStateOf(attempt: any): LoginStateMeta {
    const key = (attempt?.login_state ?? 'ok') as LoginStateKey
    const retryMins = Number(attempt?.retry_mins ?? 0)
    const fails = Number(attempt?.fails_consecutive ?? 0)

    if (key === 'banned_frozen') {
      const tail = retryMins > 0 ? ` · ещё ${retryMins} мин` : ''
      return { key, label: `забанен + заморозка${tail}`, severity: 'danger' }
    }
    if (key === 'banned') {
      return { key, label: 'забанен · вход закрыт', severity: 'danger' }
    }
    if (key === 'frozen') {
      const tail = retryMins > 0 ? ` · вход через ${retryMins} мин` : ''
      return { key, label: `заморожен (${fails} фейла)${tail}`, severity: 'warn' }
    }
    if (key === 'warning') {
      return { key, label: fails === 1 ? '1 фейл подряд' : `${fails} фейла подряд`, severity: 'info' }
    }
    return { key: 'ok', label: 'вход открыт', severity: 'success' }
  }

  /**
   * Короткая подпись заморозки для строки.
   *
   * @param attempt строка попытки
   * @returns текст вида «до 12:40 · осталось 35 мин» или null
   */
  function frozenCaptionOf(attempt: any): string | null {
    if (!attempt?.is_frozen) return null
    const parts: string[] = []
    try {
      if (attempt.frozen_until) {
        const when = new Date(attempt.frozen_until).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        parts.push(`до ${when}`)
      }
    } catch {
      // молча пропускаем битую дату
    }
    const retryMins = Number(attempt?.retry_mins ?? 0)
    if (retryMins > 0) parts.push(`осталось ${retryMins} мин`)
    return parts.length ? parts.join(' · ') : 'заморожен'
  }

  /**
   * Пометить попытки прочитанными: бейдж таба гаснет.
   */
  async function markSeen(): Promise<void> {
    try {
      const d: any = await adminApi.markLoginAttemptsSeen()
      if (d?.stats) stats.value = d.stats
      else stats.value = { ...stats.value, failed_unseen: 0 }
    } catch {
      return
    }
  }

  /**
   * Открытие таба «Безопасность»: свежий список + гашение счётчика.
   *
   * Гасим строго после загрузки, чтобы метка не ушла раньше
   * данных и бейдж не зажёгся от уже показанных попыток.
   */
  async function openTab(): Promise<void> {
    await load()
    await markSeen()
  }

  watch(filter, () => void load())

  return { items, meta, stats, unseenCount, loading, error, query, filter, page, actingId, resettingEmail, load, openTab, markSeen, setQuery, setFilter, setPage, ban, unban, resetFreeze, loginStateOf, frozenCaptionOf }
}
