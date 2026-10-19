import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { screenLockApi } from '@/services/screenlock.api'

/** Шаг диалога сброса: выбор способа → ввод кода из письма. */
export type ScreenLockResetStep = 'choice' | 'code'

/**
 * Логика сброса забытого кода скринлокера в оверлее.
 *
 * Сам сброс выполняет сервер (метка `screen_lock_reset_at`), но код
 * блокировки стирается локально: хук отдаёт наружу `onReset`, чтобы
 * `useScreenLock` убрал запись из IndexedDB и снял оверлей.
 *
 * @param onReset колбэк после подтверждённого сброса (метка в мс)
 * @example
 * const reset = useScreenLockReset((at) => lock.resetByRemote(at))
 */
export function useScreenLockReset(onReset: (resetAt: number) => Promise<void> | void) {
  const page = usePage()
  const step = ref<ScreenLockResetStep>('choice')
  const code = ref('')
  const sending = ref(false)
  const verifying = ref(false)
  const error = ref<string | null>(null)
  const info = ref<string | null>(null)
  const cooldown = ref(0)
  let cooldownTimer: ReturnType<typeof setInterval> | null = null

  const botUsername = computed(() => String((page.props as any)?.client?.telegramBot || 'U1ove_bot'))
  const botLink = computed(() => `https://t.me/${botUsername.value}`)
  const isTelegramLinked = computed(() => !!((page.props.auth as any)?.user?.telegram_id))
  // Техническая почта Telegram (`tg_*@telegram.local`) писем не принимает:
  // не предлагаем способ, который гарантированно не сработает.
  const canUseEmail = computed(() => {
    const email = String((page.props.auth as any)?.user?.email || '').toLowerCase()
    if (!email) return false
    return !(email.startsWith('tg_') && email.endsWith('@telegram.local'))
  })
  const canSubmit = computed(() => code.value.length === 6 && !verifying.value)

  /**
   * Запустить обратный отсчёт до повторной отправки письма.
   *
   * @param seconds сколько секунд ждать
   */
  function startCooldown(seconds: number): void {
    cooldown.value = Math.max(0, Math.floor(seconds))

    if (cooldownTimer) clearInterval(cooldownTimer)
    if (cooldown.value <= 0) return

    cooldownTimer = setInterval(() => {
      cooldown.value = Math.max(0, cooldown.value - 1)
      if (cooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  }

  /**
   * Запросить код на почту и перейти к его вводу.
   *
   * @returns void
   */
  async function requestCode(): Promise<void> {
    if (sending.value) return

    if (!canUseEmail.value) {
      error.value = 'Нет рабочей почты — сбрось код через Telegram-бота.'
      return
    }

    sending.value = true
    error.value = null
    info.value = null

    try {
      const result = await screenLockApi.requestCode()

      if (!result.ok) {
        error.value = result.message
        if (result.retry_after > 0) startCooldown(result.retry_after)
        return
      }

      step.value = 'code'
      code.value = ''
      info.value = 'Код отправлен на почту аккаунта'
      startCooldown(60)
    } finally {
      sending.value = false
    }
  }

  /**
   * Проверить код из письма и применить сброс.
   *
   * @returns true, если код верный и локер стёрт
   */
  async function verifyCode(): Promise<boolean> {
    if (!canSubmit.value) return false

    verifying.value = true
    error.value = null

    try {
      const result = await screenLockApi.verifyCode(code.value)

      if (!result.ok) {
        error.value = result.message
        code.value = ''
        return false
      }

      await onReset(result.reset_at || Date.now())
      return true
    } finally {
      verifying.value = false
    }
  }

  /**
   * Вернуться к выбору способа сброса.
   */
  function backToChoice(): void {
    step.value = 'choice'
    code.value = ''
    error.value = null
    info.value = null
  }

  /**
   * Остановить таймер кулдауна (при закрытии диалога/размонтировании).
   */
  function dispose(): void {
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownTimer = null
    cooldown.value = 0
  }

  return {
    step,
    code,
    sending,
    verifying,
    error,
    info,
    cooldown,
    botUsername,
    botLink,
    isTelegramLinked,
    canUseEmail,
    canSubmit,
    requestCode,
    verifyCode,
    backToChoice,
    dispose,
  }
}
