import { computed, ref } from 'vue'
import { api } from '@/services/api'

export interface TelegramNotifyPrefs {
  notify_messages: boolean
  notify_likes: boolean
  notify_matches: boolean
  notify_comments: boolean
}

const linked = ref(false)
const canNotify = ref(false)
const botUsername = ref('U1ove_bot')
const prefs = ref<TelegramNotifyPrefs>({ notify_messages: true, notify_likes: true, notify_matches: true, notify_comments: true })
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let loadPromise: Promise<void> | null = null
let lastFinishedAt = 0
let rateLimitedUntil = 0
const STATUS_COOLDOWN_MS = 10_000
const RATE_LIMIT_FALLBACK_MS = 30_000

/**
 * Тумблеры уведомлений от бота в личку Telegram.
 *
 * Бот пишет о новых сообщениях, лайках, мэтчах и комментариях с кнопкой,
 * открывающей Mini App на нужном экране, — ничего не пропустишь,
 * даже когда приложение закрыто. Вся логика здесь (Правило №1):
 * компонент только показывает тумблеры и дергает save.
 *
 * @example
 * ```ts
 * const { linked, prefs, loadTelegramNotify, saveTelegramNotify } = useTelegramNotifications()
 * await loadTelegramNotify()
 * await saveTelegramNotify({ notify_likes: false })
 * ```
 *
 * @returns состояние привязки, тумблеры и методы
 */
export function useTelegramNotifications() {
  const botLink = computed(() => `https://t.me/${botUsername.value || 'U1ove_bot'}`)

  /**
   * Подтянуть статус привязки и тумблеры.
   *
   * Успех кэшируется за сессию (`loaded`), повторные монтирования
   * (переключение табов настроек) сеть не дёргают. Ошибка 429
   * обрабатывается молча: состояние не трогаем (не врём про
   * «не привязан»), встаём в бэкофф по `Retry-After` и даём
   * повторить позже — раньше первый же 429 навсегда лочил
   * `loaded = true` с `linked = false`.
   *
   * @param force пропустить кулдаун и бэкофф (например, юзер вернулся от бота)
   */
  async function loadTelegramNotify(force = false): Promise<void> {
    if (loaded.value || loading.value) {
      if (loadPromise) await loadPromise
      return
    }

    const now = Date.now()
    if (!force) {
      if (now < rateLimitedUntil) return
      if (lastFinishedAt !== 0 && now - lastFinishedAt < STATUS_COOLDOWN_MS) return
    }

    loading.value = true
    errorMessage.value = ''

    loadPromise = (async () => {
      const startedAt = Date.now()
      try {
        const response = await api.get('/api/telegram/status')
        const data = response.data ?? {}
        linked.value = Boolean(data.linked)
        canNotify.value = Boolean(data.can_notify)
        if (typeof data.bot_username === 'string' && data.bot_username !== '') {
          botUsername.value = data.bot_username
        }
        prefs.value = {
          notify_messages: data.notify_messages ?? true,
          notify_likes: data.notify_likes ?? true,
          notify_matches: data.notify_matches ?? true,
          notify_comments: data.notify_comments ?? true,
        }
        loaded.value = true
      } catch (requestError: unknown) {
        if (isRateLimited(requestError)) {
          rateLimitedUntil = startedAt + readRetryAfterMs(requestError)
          return
        }
        linked.value = false
        canNotify.value = false
      } finally {
        loading.value = false
        lastFinishedAt = Date.now()
        loadPromise = null
      }
    })()

    await loadPromise
  }

  /**
   * Проверить, что ошибка — 429 от троттлинга.
   *
   * @param requestError ошибка из axios
   * @returns true когда сервер ответил 429
   */
  function isRateLimited(requestError: unknown): boolean {
    if (typeof requestError !== 'object' || requestError === null) {
      return false
    }
    const response = (requestError as { response?: { status?: unknown } }).response
    return response?.status === 429
  }

  /**
   * Прочитать `Retry-After` из 429-ответа.
   *
   * @param requestError ошибка из axios с 429-ответом
   * @returns миллисекунды бэкоффа (фолбэк 30с)
   */
  function readRetryAfterMs(requestError: unknown): number {
    try {
      const headers = (requestError as { response?: { headers?: Record<string, unknown> } }).response?.headers ?? {}
      const raw = headers['retry-after'] ?? headers['Retry-After']
      const seconds = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
      if (Number.isFinite(seconds) && seconds > 0 && seconds <= 300) {
        return seconds * 1000
      }
    } catch {
      // фолбэк ниже
    }
    return RATE_LIMIT_FALLBACK_MS
  }

  /**
   * Сохранить тумблеры (оптимистично + откат при ошибке).
   *
   * @param patch часть тумблеров для обновления
   * @returns true когда сервер принял
   */
  async function saveTelegramNotify(patch: Partial<TelegramNotifyPrefs>): Promise<boolean> {
    const previous = { ...prefs.value }
    prefs.value = { ...prefs.value, ...patch }
    saving.value = true
    errorMessage.value = ''

    try {
      const response = await api.patch('/api/telegram/preferences', patch)
      const data = response.data ?? {}
      prefs.value = {
        notify_messages: data.notify_messages ?? prefs.value.notify_messages,
        notify_likes: data.notify_likes ?? prefs.value.notify_likes,
        notify_matches: data.notify_matches ?? prefs.value.notify_matches,
        notify_comments: data.notify_comments ?? prefs.value.notify_comments,
      }
      return true
    } catch {
      prefs.value = previous
      errorMessage.value = 'Не получилось сохранить. Попробуйте ещё раз.'
      return false
    } finally {
      saving.value = false
    }
  }

  return { linked, canNotify, botUsername, botLink, prefs, loading, loaded, saving, errorMessage, loadTelegramNotify, saveTelegramNotify }
}
