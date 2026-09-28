import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { emailApi } from '@/services/email.api'

/**
 * Подтверждение почты: статус, баннер, повторная отправка ссылки.
 *
 * Без подтверждённой почты запрещены лайки в свайпах и отправка
 * сообщений — хук отдаёт флаги для баннера и гейтов кнопок.
 * Компонент только отображает состояние хука.
 *
 * @returns состояние верификации и действие повторной отправки
 *
 * @example
 * const emailVerification = useEmailVerification()
 * await emailVerification.refresh()
 */
export function useEmailVerification() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user ?? null)

  const serverVerified = ref<boolean | null>(null)
  const serverEmail = ref<string | null>(null)
  const resending = ref(false)
  const sent = ref(false)
  const error = ref<string | null>(null)
  const justVerified = ref(false)

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
   * Нужен ли баннер «Подтвердите почту».
   *
   * @returns true для залогиненных без верификации
   */
  const needsVerification = computed(() => {
    if (!authUser.value) {
      return false
    }

    return !isVerified.value
  })

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
   * Отправить ссылку подтверждения повторно.
   *
   * @returns void
   */
  async function resend(): Promise<void> {
    if (resending.value) {
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отправить письмо. Попробуй позже.'
    } finally {
      resending.value = false
    }
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
    needsVerification,
    email,
    resending,
    sent,
    error,
    justVerified,
    refresh,
    resend,
    consumeVerifiedFlag,
  }
}
