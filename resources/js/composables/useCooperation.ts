import { computed, ref } from 'vue'
import { api } from '@/services/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Диалог заявки на сотрудничество («Писать нам» на лендинге).
 *
 * Гость вводит email бизнеса (+ необязательный комментарий),
 * бэк извлекает название компании из email и уведомляет админов
 * (inbox + письмо). Вся логика здесь, компонент только рисует.
 *
 * @returns состояние диалога и действие отправки
 * @example const coop = useCooperation(); coop.open()
 */
export function useCooperation() {
  const open = ref(false)
  const email = ref('')
  const message = ref('')
  const error = ref<string | null>(null)
  const sending = ref(false)
  const sentCompany = ref<string | null>(null)

  const emailValid = computed(() => EMAIL_RE.test(email.value.trim()))

  const canSubmit = computed(() => emailValid.value && !sending.value && sentCompany.value === null)

  /**
   * Открыть диалог с чистым состоянием.
   */
  function show(): void {
    error.value = null
    sending.value = false
    sentCompany.value = null
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
      })
      sentCompany.value = String(data?.company ?? '').trim() || 'Ваша компания'
    } catch (err: any) {
      const status = err?.response?.status
      error.value =
        status === 429
          ? 'Слишком много попыток — попробуй через минуту'
          : (err?.response?.data?.message ?? 'Не получилось отправить. Попробуй ещё раз');
    } finally {
      sending.value = false
    }
  }

  return { open, email, message, error, sending, sentCompany, emailValid, canSubmit, show, close, submit }
}
