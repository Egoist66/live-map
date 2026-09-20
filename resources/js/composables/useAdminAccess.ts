import { computed, onUnmounted, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { adminApi } from '@/services/admin.api'

/** Пауза между отправками кода, секунд (как на бэке). */
const RESEND_COOLDOWN = 60

/**
 * Вход в панель модерации по коду из почты.
 *
 * Админ вводит свою почту — туда прилетают 6 цифр — вводит их.
 * Чужую почту бэк не обслуживает. Разблокировка живёт в сессии час.
 *
 * @returns состояние гейта и действия
 *
 * @example
 * const access = useAdminAccess()
 * onMounted(() => access.check())
 */
export function useAdminAccess() {
  const accountEmail = computed(() => String((usePage().props.auth as any)?.user?.email ?? ''))
  const email = ref('')
  const code = ref('')
  const step = ref<'email' | 'code'>('email')
  const unlocked = ref(false)
  const checking = ref(true)
  const acting = ref(false)
  const error = ref<string | null>(null)
  const codeExpiresIn = ref(0)
  const cooldownLeft = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null

  /**
   * Секундный тикер обратных отсчётов (жизнь кода, пауза повтора).
   */
  function startTicker(): void {
    stopTicker()
    timer = setInterval(() => {
      if (codeExpiresIn.value > 0) codeExpiresIn.value -= 1
      if (cooldownLeft.value > 0) cooldownLeft.value -= 1
    }, 1000)
  }

  function stopTicker(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  onUnmounted(() => stopTicker())

  const codeTtlLabel = computed(() => {
    const s = Math.max(0, codeExpiresIn.value)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })

  /**
   * Текст ошибки с человеческим пояснением 429.
   */
  function failMessage(e: unknown, fallback: string): string {
    const err = e as { response?: { status?: number; data?: { message?: string } } }
    if (err.response?.status === 429) return 'Слишком много попыток — подожди минуту и повтори.'
    return err.response?.data?.message ?? fallback
  }

  /**
   * Запросить статус гейта; почту подставляем из аккаунта.
   */
  async function check(): Promise<void> {
    checking.value = true
    error.value = null
    try {
      const d: any = await adminApi.accessStatus()
      if (!email.value) email.value = String(d?.email ?? accountEmail.value ?? '')
      unlocked.value = !!d?.unlocked
      if (d?.code_sent && !unlocked.value) {
        step.value = 'code'
        codeExpiresIn.value = Number(d?.code_expires_in ?? 0)
        startTicker()
      }
    } catch {
      unlocked.value = false
    } finally {
      checking.value = false
    }
  }

  /**
   * Отправить код на свою почту.
   */
  async function requestCode(): Promise<boolean> {
    if (!email.value.trim() || acting.value || cooldownLeft.value > 0) return false
    acting.value = true
    error.value = null
    try {
      const d: any = await adminApi.requestAccessCode(email.value.trim())
      step.value = 'code'
      code.value = ''
      codeExpiresIn.value = Number(d?.expires_in ?? 600)
      cooldownLeft.value = RESEND_COOLDOWN
      startTicker()
      return true
    } catch (e: unknown) {
      error.value = failMessage(e, 'Не удалось отправить код')
      return false
    } finally {
      acting.value = false
    }
  }

  /**
   * Проверить код и открыть панель.
   */
  async function verify(): Promise<boolean> {
    if (code.value.trim().length !== 6 || acting.value) return false
    acting.value = true
    error.value = null
    try {
      await adminApi.verifyAccessCode(email.value.trim(), code.value.trim())
      code.value = ''
      stopTicker()
      unlocked.value = true
      return true
    } catch (e: unknown) {
      error.value = failMessage(e, 'Не удалось проверить код')
      return false
    } finally {
      acting.value = false
    }
  }

  /**
   * Вернуться к вводу почты (код не пришёл / не та почта).
   */
  function backToEmail(): void {
    step.value = 'email'
    code.value = ''
    error.value = null
  }

  /**
   * Закрыть панель до следующего кода.
   */
  async function lock(): Promise<void> {
    try {
      await adminApi.lockAccess()
    } catch {
      return
    } finally {
      unlocked.value = false
      step.value = 'email'
      code.value = ''
      stopTicker()
    }
  }

  return { email, code, step, unlocked, checking, acting, error, codeExpiresIn, cooldownLeft, codeTtlLabel, check, requestCode, verify, backToEmail, lock }
}
