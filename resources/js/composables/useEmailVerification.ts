import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { emailApi } from '@/services/email.api'

/**
 * Подтверждение почты: статус, модалка, отправка ссылки по кнопке.
 *
 * Без подтверждённой почты запрещены лайки в свайпах и отправка
 * сообщений — хук отдаёт флаги для модалки и гейтов кнопок.
 * Стаффу (админ/модератор) модалка не показывается: гейт почты
 * на него не действует, при желании подтвердит из настроек.
 * Письмо уходит только по явной кнопке.
 *
 * Состояние общее (singleton на модуль): баннер, плашка в свайпах
 * и карточка в настройках видят один `resending`/`cooldownLeft`.
 * Кнопка блокируется сразу по нажатию (`resending=true` синхронно
 * до `await`), после успеха — кулдаун 60 секунд во всех местах.
 * Компонент только отображает состояние хука.
 *
 * @returns состояние верификации и действие отправки ссылки
 *
 * @example
 * const emailVerification = useEmailVerification()
 * await emailVerification.refresh()
 */

// Общее состояние: один клик «Подтвердить» дизейблит все кнопки сразу.
const serverVerified = ref<boolean | null>(null)
const serverEmail = ref<string | null>(null)
const resending = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)
const justVerified = ref(false)
const cooldownLeft = ref(0)
const dismissed = ref(false)

let cooldownTimer: ReturnType<typeof setInterval> | null = null

/**
 * Запустить кулдаун кнопки отправки.
 *
 * @param seconds длительность кулдауна
 * @returns void
 */
function startCooldown(seconds: number): void {
  cooldownLeft.value = seconds

  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }

  cooldownTimer = setInterval(() => {
    cooldownLeft.value -= 1

    if (cooldownLeft.value <= 0) {
      cooldownLeft.value = 0

      if (cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }
  }, 1000)
}

export function useEmailVerification() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user ?? null)

  /**
   * Стафф ли текущий пользователь (админ или модератор).
   *
   * @returns true когда гейт почты не действует и модалка не нужна
   */
  const isStaff = computed(() => {
    const user = authUser.value

    if (!user) {
      return false
    }

    return !!user.is_admin || user.role === 'admin' || user.role === 'moderator'
  })

  /**
   * Почта подтверждена: серверный статус приоритетнее,
   * иначе смотрим shared-пропсы Inertia.
   *
   * @returns true когда email_verified_at заполнен
   */
  const isVerified = computed(() => {
    if (serverVerified.value !== null) {
      return serverVerified.value
    }

    return !!authUser.value?.email_verified_at
  })

  /**
   * Нужна ли модалка «Подтвердите почту».
   *
   * @returns true для обычных залогиненных без верификации
   */
  const needsVerification = computed(() => {
    if (!authUser.value) {
      return false
    }

    if (isStaff.value) {
      return false
    }

    return !isVerified.value
  })

  /**
   * Показывать ли модалку прямо сейчас (не закрыта на «потом»).
   *
   * @returns true когда есть нужда и пользователь не отложил
   */
  const shouldShowModal = computed(() => needsVerification.value && !dismissed.value && !justVerified.value)

  /**
   * Можно ли жать «Подтвердить почту» прямо сейчас.
   *
   * @returns false пока идёт отправка или тикает кулдаун
   */
  const canResend = computed(() => !resending.value && cooldownLeft.value <= 0)

  /**
   * Почта текущего пользователя.
   *
   * @returns email либо пустая строка
   */
  const email = computed(() => {
    if (serverEmail.value !== null) {
      return serverEmail.value
    }

    return String(authUser.value?.email ?? '')
  })

  /**
   * Подтянуть свежий статус с бэкенда.
   *
   * @returns void
   */
  async function refresh(): Promise<void> {
    try {
      const status = await emailApi.status()
      serverVerified.value = status.verified
      serverEmail.value = status.email
    } catch {
      return
    }
  }

  /**
   * Отправить ссылку подтверждения по явной кнопке.
   *
   * Сразу ставит `resending` — все кнопки (баннер, свайпы, настройки)
   * дизейблятся до ответа. После успеха — кулдаун 60 секунд,
   * 429 превращает в понятный текст с секундами из `Retry-After`.
   *
   * @returns void
   */
  async function resend(): Promise<void> {
    if (resending.value || cooldownLeft.value > 0) {
      return
    }

    if (serverVerified.value === true) {
      return
    }

    resending.value = true
    error.value = null

    try {
      const res = await emailApi.resend()

      if (res.verified) {
        serverVerified.value = true
        sent.value = false
        return
      }

      sent.value = true
      dismissed.value = false
      startCooldown(60)
    } catch (e: unknown) {
      const err = e as {
        response?: {
          status?: number
          headers?: Record<string, string>
          data?: { message?: string }
        }
      }
      const status = err.response?.status ?? 0

      if (status === 429) {
        const retryAfter = Number(err.response?.headers?.['retry-after'] ?? 60)
        const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60
        error.value = `Слишком часто. Подождите ${waitSeconds} сек. и попробуйте снова.`
        startCooldown(Math.min(waitSeconds, 300))
        return
      }

      error.value = err.response?.data?.message ?? 'Не удалось отправить письмо. Попробуй позже.'
    } finally {
      resending.value = false
    }
  }

  /**
   * Отложить модалку до следующей загрузки страницы.
   *
   * @returns void
   */
  function dismiss(): void {
    dismissed.value = true
  }

  /**
   * Отметить переход по ссылке из письма (?verified=1).
   *
   * Снимает локальные флаги и поднимает флаг успеха для тоста.
   * Вызывать один раз при монтировании страницы.
   *
   * @returns true если в URL был флаг верификации
   */
  function consumeVerifiedFlag(): boolean {
    let hasFlag = false

    try {
      hasFlag = new URLSearchParams(window.location.search).get('verified') === '1'
    } catch {
      hasFlag = false
    }

    if (!hasFlag) {
      return false
    }

    serverVerified.value = true
    sent.value = false
    justVerified.value = true

    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('verified')
      window.history.replaceState(null, '', url.toString())
    } catch {
      return true
    }

    return true
  }

  return {
    isVerified,
    isStaff,
    needsVerification,
    shouldShowModal,
    canResend,
    cooldownLeft,
    email,
    resending,
    sent,
    error,
    justVerified,
    refresh,
    resend,
    dismiss,
    consumeVerifiedFlag,
  }
}
