import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { useHoneypot } from '@/composables/useTurnstile'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Общее состояние диалога: `Welcome.vue` (кнопка «Писать нам»)
 * и `CooperationDialog.vue` вызывают хук независимо, поэтому
 * состояние живёт в модуле — иначе кнопка меняет свой `open`,
 * а диалог слушает свой и никогда не открывается.
 */
const open = ref(false)
const email = ref('')
const message = ref('')
const error = ref<string | null>(null)
const sending = ref(false)
const sentCompany = ref<string | null>(null)
// Капча + honeypot: гостевой POST без auth — главная мишень спам-ботов.
const captchaToken = ref('')
const trap = useHoneypot()

/**
 * Диалог заявки на сотрудничество («Писать нам» на лендинге).
 *
 * Гость вводит email бизнеса (+ необязательный комментарий),
 * бэк извлекает название компании из email и уведомляет админов
 * (inbox + письмо). Вся логика здесь, компонент только рисует.
 *
 * @returns состояние диалога и действие отправки (состояние общее для всех вызовов)
 * @example const coop = useCooperation(); coop.show()
 */
export function useCooperation() {
  const emailValid = computed(() => EMAIL_RE.test(email.value.trim()))

  const canSubmit = computed(() => emailValid.value && !sending.value && sentCompany.value === null)

  /**
   * Открыть диалог с чистым состоянием.
   */
  function show(): void {
    error.value = null
    sending.value = false
    sentCompany.value = null
    captchaToken.value = ''
    open.value = true
  }

  /**
   * Закрыть диалог.
   */
  function close(): void {
    open.value = false
  }

  /**
   * Отправить заявку на бэк.
   */
  async function submit(): Promise<void> {
    const cleanEmail = email.value.trim()

    if (!EMAIL_RE.test(cleanEmail)) {
      error.value = 'Проверь email — похоже, там опечатка'
      return
    }

    if (sending.value) {
      return
    }

    sending.value = true
    error.value = null

    try {
      const { data } = await api.post('/api/cooperation', {
        email: cleanEmail,
        message: message.value.trim() || undefined,
        captcha_token: captchaToken.value || undefined,
        website: trap.value.value || undefined,
      })
      sentCompany.value = String(data?.company ?? '').trim() || 'Ваша компания'
    } catch (err: any) {
      const status = err?.response?.status
      const captchaError = err?.response?.data?.errors?.captcha_token?.[0]
      error.value =
        typeof captchaError === 'string'
          ? captchaError
          : status === 429
            ? 'Слишком много попыток — попробуй через минуту'
            : (err?.response?.data?.message ?? 'Не получилось отправить. Попробуй ещё раз');
    } finally {
      sending.value = false
    }
  }

  return { open, email, message, error, sending, sentCompany, emailValid, canSubmit, show, close, submit, captchaToken, trap }
}
