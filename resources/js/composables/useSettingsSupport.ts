import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { api } from '@/services/api'

/**
 * Email поддержки (почта админа) из shared-пропсов Inertia.
 *
 * @returns email поддержки с фолбэком
 */
export function useSupportEmail(): string {
  try {
    const email = (usePage().props as any)?.support?.email
    if (typeof email === 'string' && email.includes('@')) {
      return email
    }
  } catch {
  }
  return 'razormad666@gmail.com'
}

/**
 * Форма обращения в поддержку: отправка письмом админам через SMTP.
 *
 * POST /api/support (троттл 6/мин) — бэк сам шлёт письмо на почту
 * админа/модераторов и дублирует inbox-уведомлением. Никаких
 * mailto-ссылок: всё уходит прямо из интерфейса.
 *
 * @param user computed-аккаунт для подписи (имя/email подставит бэк)
 * @returns поля формы, статусы и методы отправки
 *
 * @example
 * ```ts
 * const support = useSupportForm(u)
 * await support.sendSupport()
 * ```
 */
export function useSupportForm(user: any) {
  const supportSubject = ref('')
  const supportBody = ref('')
  const donateSel = ref(5)
  const sending = ref(false)
  const sent = ref(false)
  const sendError = ref<string | null>(null)

  function setDonate(usd: number) {
    donateSel.value = usd
  }

  /**
   * Отправить обращение в поддержку через бэкенд (SMTP админам).
   *
   * @returns true когда письмо принято (201)
   */
  async function sendSupport(): Promise<boolean> {
    if (sending.value) return false
    sendError.value = null
    sent.value = false

    const subject = supportSubject.value.trim()
    const message = supportBody.value.trim()

    if (subject.length < 3) {
      sendError.value = 'Укажи тему чуть подробнее (минимум 3 символа).'
      return false
    }

    if (message.length < 10) {
      sendError.value = 'Опиши проблему чуть подробнее (минимум 10 символов).'
      return false
    }

    sending.value = true

    try {
      await api.post('/api/support', { subject, message })
      supportSubject.value = ''
      supportBody.value = ''
      sent.value = true
      return true
    } catch (e: any) {
      const status = e?.response?.status
      sendError.value = status === 429
        ? 'Слишком часто — подожди минутку и попробуй ещё раз.'
        : (e?.response?.data?.message ?? 'Не получилось отправить. Попробуй ещё раз.')
      return false
    } finally {
      sending.value = false
    }
  }
  function mailToDonate(ex: { usdRate: any }) {
    const usd = donateSel.value
    const byn = ex.usdRate.value ? (usd * ex.usdRate.value).toFixed(2) + ' BYN' : `${usd}$`
    const subj = encodeURIComponent(`Донат UPin — $${usd} (~${byn})`)
    const body = encodeURIComponent(`Привет! Хочу задонатить $${usd} (~${byn}) разработчику UPin.\n\nПользователь: ${user.value.name} <${user.value.email}>\nТариф: ${user.value.plan || 'free'}\n\nСообщение:\n`)
    window.location.href = `mailto:${useSupportEmail()}?subject=${subj}&body=${body}`
  }
  return { supportSubject, supportBody, donateSel, sending, sent, sendError, setDonate, sendSupport, mailToDonate }
}

export function useSettingsBioPreview(user: any) {
  const bioPreviewText = computed(() => ((user.value as any).bio || '').trim())
  const bioPreviewEmpty = computed(() => bioPreviewText.value.length === 0)
  return { bioPreviewText, bioPreviewEmpty }
}
