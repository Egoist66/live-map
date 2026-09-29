import { computed, ref } from 'vue'
import { api } from '@/services/api'

export interface TelegramNotifyPrefs {
  notify_messages: boolean
  notify_likes: boolean
  notify_matches: boolean
}

const linked = ref(false)
const canNotify = ref(false)
const botUsername = ref('U1ove_bot')
const prefs = ref<TelegramNotifyPrefs>({ notify_messages: true, notify_likes: true, notify_matches: true })
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let loadPromise: Promise<void> | null = null

/**
 * Тумблеры уведомлений от бота в личку Telegram.
 *
 * Бот пишет о новых сообщениях, лайках и мэтчах с кнопкой,
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
   * Подтянуть статус привязки и тумблеры (идемпотентно за сессию).
   */
  async function loadTelegramNotify(): Promise<void> {
    if (loaded.value || loading.value) {
      if (loadPromise) await loadPromise
      return
    }

    loading.value = true
    errorMessage.value = ''

    loadPromise = (async () => {
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
        }
      } catch {
        linked.value = false
        canNotify.value = false
      } finally {
        loading.value = false
        loaded.value = true
        loadPromise = null
      }
    })()

    await loadPromise
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
