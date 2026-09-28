import { ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { api } from '@/services/api'
import { isTelegramWebView, useTelegram } from '@/composables/useTelegram'

type TelegramAuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

const status = ref<TelegramAuthStatus>('idle')
const errorMessage = ref('')
const isNewAccount = ref(false)
let attempted = false

/**
 * Проверить, что текущий визит уже залогинен (Inertia props).
 *
 * @returns true когда auth.user присутствует
 */
function isLoggedIn(): boolean {
  try {
    const auth = (usePage().props as unknown as { auth?: { user?: { id?: number } | null } }).auth

    return Number(auth?.user?.id) > 0
  } catch {
    return false
  }
}

/**
 * Автовход через Telegram Mini App (@U1ove_bot).
 *
 * Только мост initData → POST /api/telegram/auth. Тема, viewport
 * и BackButton живут в `useTelegram` / `useTelegramNavigation`.
 * После успешной сессии дёргаем `router.reload()`, чтобы Inertia
 * подтянула свежие auth-пропсы без полной перезагрузки.
 *
 * @example
 * ```ts
 * const { authWithTelegram } = useTelegramAuth()
 * await authWithTelegram()
 * ```
 *
 * @returns статус входа и методы привязки
 */
export function useTelegramAuth() {
  /**
   * Отправить initData на бэк и поднять web-сессию.
   *
   * Идемпотентен за визит (флаг attempted) + пропускаем залогиненных.
   * Ошибки не кидаем наружу — Mini App обязан открыться даже если
   * подпись не сошлась, просто как гость.
   *
   * @returns true когда сессия поднята или уже была
   */
  async function authWithTelegram(): Promise<boolean> {
    if (attempted || status.value === 'loading') {
      return status.value === 'authenticated' || isLoggedIn()
    }
    attempted = true

    if (isLoggedIn()) {
      status.value = 'authenticated'
      return true
    }

    if (!isTelegramWebView()) {
      status.value = 'idle'
      return false
    }

    const { initData } = useTelegram()
    const rawInitData = initData.value || window.Telegram?.WebApp?.initData || ''

    if (rawInitData === '') {
      status.value = 'idle'
      return false
    }

    status.value = 'loading'
    errorMessage.value = ''

    try {
      const response = await api.post('/api/telegram/auth', { initData: rawInitData })
      const isNew = Boolean(response.data?.is_new)
      isNewAccount.value = isNew
      status.value = 'authenticated'

      await reloadAuthProps()

      return true
    } catch (error) {
      status.value = 'error'
      errorMessage.value = extractMessage(error)
      return false
    }
  }

  /**
   * Привязать Telegram к текущему залогиненному аккаунту.
   *
   * @returns true при успешной привязке
   */
  async function linkTelegram(): Promise<boolean> {
    const rawInitData = window.Telegram?.WebApp?.initData || ''

    if (rawInitData === '') {
      errorMessage.value = 'Откройте сайт через кнопку бота в Telegram.'
      return false
    }

    try {
      await api.post('/api/telegram/auth', { initData: rawInitData })
      await reloadAuthProps()
      return true
    } catch (error) {
      errorMessage.value = extractMessage(error)
      return false
    }
  }

  /**
   * Отвязать Telegram от аккаунта.
   *
   * @returns true при успешной отвязке
   */
  async function unlinkTelegram(): Promise<boolean> {
    try {
      await api.delete('/api/telegram/link')
      await reloadAuthProps()
      return true
    } catch (error) {
      errorMessage.value = extractMessage(error)
      return false
    }
  }

  /**
   * Перетянуть свежие auth-пропсы после смены сессии.
   */
  async function reloadAuthProps(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        router.reload({
          only: ['auth'],
          onFinish: () => resolve(),
          onError: () => resolve(),
        })
        setTimeout(() => resolve(), 2500)
      })
    } catch {
      // No-op: страница и так в корректной сессии.
    }
  }

  /**
   * Достать человекочитаемый текст ошибки axios.
   *
   * @param error ошибка запроса
   * @returns сообщение для тоста
   */
  function extractMessage(error: unknown): string {
    const fallback = 'Не получилось войти через Telegram.'

    if (typeof error !== 'object' || error === null) {
      return fallback
    }

    const response = (error as { response?: { data?: { message?: unknown }; status?: number } }).response

    if (typeof response?.data?.message === 'string' && response.data.message !== '') {
      return response.data.message
    }

    if (response?.status === 409) {
      return 'Этот Telegram уже привязан к другому аккаунту.'
    }

    return fallback
  }

  /**
   * Сбросить флаг попытки (для тестов и повторного логина).
   */
  function resetAttempt(): void {
    attempted = false
    status.value = 'idle'
    errorMessage.value = ''
  }

  return { status, errorMessage, isNewAccount, authWithTelegram, linkTelegram, unlinkTelegram, resetAttempt }
}
