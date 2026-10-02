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
 * Достать initData из hash URL как запасной вариант.
 *
 * Telegram при запуске Mini App кладёт стартовые параметры в hash
 * (`#tgWebAppData=<initData>&tgWebAppVersion=...`). Обычно initData
 * читается из `window.Telegram.WebApp.initData`, но если объект
 * WebApp ещё не готов, а hash уже на месте — забираем оттуда,
 * чтобы автовход не умирал вхолостую.
 *
 * @returns сырая строка initData или пусто
 */
function readInitDataFromHash(): string {
  try {
    const hash = window.location.hash || ''

    if (!hash.includes('tgWebAppData')) {
      return ''
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const raw = params.get('tgWebAppData') || ''

    return raw !== '' ? decodeURIComponent(raw) : ''
  } catch {
    return ''
  }
}

/**
 * Собрать initData из всех доступных источников.
 *
 * Порядок: реактивный ref моста → живой WebApp → hash URL.
 *
 * @param refValue значение initData из useTelegram()
 * @returns сырая строка initData или пусто
 */
function resolveInitData(refValue: string): string {
  if (refValue !== '') {
    return refValue
  }

  try {
    const fromWebApp = window.Telegram?.WebApp?.initData || ''

    if (fromWebApp !== '') {
      return fromWebApp
    }
  } catch {
    // No-op: WebApp может отсутствовать.
  }

  return readInitDataFromHash()
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
   * Отправить initData на бэк и поднять/сверить web-сессию.
   *
   * Идемпотентен за визит (флаг attempted ставится только когда
   * есть что отправлять). Внутри Telegram WebView сверяемся всегда,
   * даже залогиненными: привязку могли увести в боте на другой
   * аккаунт (переключение по коду) — тогда бэк вернёт
   * `switched: true` и страница жёстко перезагрузится уже под новым
   * аккаунтом, иначе Mini App залипает на старой сессии.
   * Пустой initData попыткой не считается — повтор возможен позже,
   * когда WebApp догрузится. Ошибки не кидаем наружу — Mini App
   * обязан открыться даже если подпись не сошлась, просто как гость.
   *
   * @returns true когда сессия поднята или уже была
   */
  async function authWithTelegram(): Promise<boolean> {
    if (attempted || status.value === 'loading') {
      return status.value === 'authenticated' || isLoggedIn()
    }

    if (!isTelegramWebView()) {
      status.value = isLoggedIn() ? 'authenticated' : 'idle'
      return isLoggedIn()
    }

    const { initData } = useTelegram()
    const rawInitData = resolveInitData(initData.value)

    if (rawInitData === '') {
      status.value = isLoggedIn() ? 'authenticated' : 'idle'
      return isLoggedIn()
    }

    attempted = true

    status.value = 'loading'
    errorMessage.value = ''

    try {
      const response = await api.post('/api/telegram/auth', { initData: rawInitData })
      const isNew = Boolean(response.data?.is_new)
      isNewAccount.value = isNew
      status.value = 'authenticated'

      if (response.data?.switched === true) {
        window.location.reload()

        return true
      }

      await reloadAuthProps()
      redirectGuestToApp()

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
    const { initData } = useTelegram()
    const rawInitData = resolveInitData(initData.value)

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
   * Увести с гостевых экранов внутрь приложения после автовхода.
   *
   * Без этого Mini App остаётся на форме логина с уже поднятой сессией.
   * Трогаем только /login и / — читателя FAQ/контактов не дёргаем.
   */
  function redirectGuestToApp(): void {
    try {
      const path = window.location.pathname

      if (path === '/login' || path === '/') {
        router.visit('/swipes')
      }
    } catch {
      // No-op: остались на текущей странице с рабочей сессией.
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

    if (response?.status === 419) {
      return 'Сессия устарела — закройте и откройте Mini App заново.'
    }

    if (response?.status === 401) {
      return 'Telegram не подтвердил вход. Откройте приложение через кнопку бота заново.'
    }

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

  /**
   * Повторить автовход после ошибки (кнопка «Попробовать снова»).
   *
   * Сбрасывает флаг попытки и идёт на новый круг: к этому моменту
   * WebApp обычно уже догрузился и initData на месте.
   *
   * @returns true когда сессия поднята
   */
  async function retryTelegramAuth(): Promise<boolean> {
    resetAttempt()
    return authWithTelegram()
  }

  return { status, errorMessage, isNewAccount, authWithTelegram, retryTelegramAuth, linkTelegram, unlinkTelegram, resetAttempt }
}
