import { computed, onBeforeUnmount, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Конфиг капчи с бэка (Inertia shared props `captcha`).
 *
 * Бэк шарит `enabled` + `siteKey` когда заданы TURNSTILE_*-ключи.
 * Без ключей (локальный dev) капча выключена: виджет не рендерится,
 * токен пустой, сервер пропускает проверку.
 *
 * @returns флаг включения и публичный sitekey
 * @example
 * const { captchaEnabled } = useCaptchaConfig()
 */
export function useCaptchaConfig() {
  const snapshot = computed(
    () =>
      (usePage().props as unknown as {
        captcha?: { enabled?: boolean; siteKey?: string }
      }).captcha ?? {},
  )

  /** Включена ли капча (есть ключи на бэке). */
  const captchaEnabled = computed(() => snapshot.value.enabled === true)

  /** Публичный sitekey виджета (пусто когда выключена). */
  const captchaSiteKey = computed(() => String(snapshot.value.siteKey ?? ''))

  return { captchaEnabled, captchaSiteKey }
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback'

let scriptPromise: Promise<void> | null = null

/**
 * Однократно подгрузить скрипт Turnstile (explicit render).
 *
 * @returns промис загрузки скрипта
 */
function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile доступен только в браузере'))
  }

  if (window.turnstile) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      scriptPromise = null
      reject(new Error('Не удалось загрузить капчу'))
    }, 15000)

    window.onloadTurnstileCallback = () => {
      window.clearTimeout(timeout)
      resolve()
    }

    const tag = document.createElement('script')
    tag.src = SCRIPT_URL
    tag.async = true
    tag.defer = true
    tag.onerror = () => {
      window.clearTimeout(timeout)
      scriptPromise = null
      reject(new Error('Не удалось загрузить капчу'))
    }
    document.head.appendChild(tag)
  })

  return scriptPromise
}

/**
 * Виджет Cloudflare Turnstile для гостевой формы.
 *
 * Вся логика здесь (Правило №1): компонент `TurnstileWidget.vue`
 * только рисует контейнер и прокидывает токен через v-model.
 * Токен одноразовый: после успешной отправки формы вызывай `reset()`.
 *
 * @returns контейнер, токен, состояние и действия виджета
 * @example
 * const t = useTurnstile()
 * // <TurnstileWidget v-model:token="t.token.value" @reset="..." />
 * payload.captcha_token = t.token.value
 */
export function useTurnstile() {
  const { captchaEnabled, captchaSiteKey } = useCaptchaConfig()

  const container = ref<HTMLElement | null>(null)
  const token = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  let widgetId: string | null = null

  /**
   * Отрендерить виджет в контейнер. Ноп когда капча выключена.
   */
  async function render(): Promise<void> {
    if (!captchaEnabled.value) {
      return
    }

    if (!container.value || widgetId !== null) {
      return
    }

    const siteKey = captchaSiteKey.value

    if (siteKey === '') {
      return
    }

    isLoading.value = true
    loadError.value = null

    try {
      await ensureTurnstileScript()

      if (!container.value || !window.turnstile) {
        return
      }

      widgetId = window.turnstile.render(container.value, {
        sitekey: siteKey,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        callback: (nextToken: string) => {
          token.value = String(nextToken ?? '')
        },
        'expired-callback': () => {
          token.value = ''
        },
        'error-callback': () => {
          token.value = ''
        },
      })
    } catch {
      loadError.value = 'Капча не загрузилась — проверь соединение и обнови страницу'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Сбросить виджет (новый токен): вызывать после отправки формы
   * и при 422 `captcha_token` с бэка (токен одноразовый/протухший).
   */
  function reset(): void {
    token.value = ''

    if (widgetId !== null && window.turnstile) {
      try {
        window.turnstile.reset(widgetId)
      } catch {
        // Виджет уже удалён — молча игнорируем.
      }
    }
  }

  onBeforeUnmount(() => {
    if (widgetId !== null && window.turnstile) {
      try {
        window.turnstile.remove(widgetId)
      } catch {
        // Уже удалён — нечего чистить.
      }
    }

    widgetId = null
  })

  return { captchaEnabled, container, token, isLoading, loadError, render, reset }
}

/**
 * Honeypot-ловушка для ботов (пара к `TurnstileService::honeypotFilled`).
 *
 * Поле `website` рисуется скрытым через CSS: человек его не видит,
 * примитивный бот заполняет. Значение всегда уходит пустым у людей —
 * бэк режет непустое как 100% бота (тихо, без подсказок).
 *
 * @returns имя поля, значение и CSS-класс скрытия
 * @example
 * const trap = useHoneypot()
 * // <input v-model="trap.value.value" :name="trap.fieldName" :class="trap.hiddenClass" ... />
 */
export function useHoneypot() {
  /** Имя поля, которое проверяет бэк. */
  const fieldName = 'website'

  /** Значение (у человека всегда пусто). */
  const value = ref('')

  /** Класс скрытия: вне экрана, но в DOM (display:none боты иногда чуют). */
  const hiddenClass = 'bot-trap-field'

  return { fieldName, value, hiddenClass }
}
