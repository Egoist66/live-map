import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

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

export function useSupportForm(user: any) {
  const supportSubject = ref('')
  const supportBody = ref('')
  const donateSel = ref(5)
  function setDonate(usd: number) {
    donateSel.value = usd
  }
  function mailToSupport() {
    const subj = encodeURIComponent(supportSubject.value || 'Обращение в поддержку UPin')
    const who = `Пользователь: ${user.value.name} <${user.value.email}>`
    const body = encodeURIComponent(supportBody.value + (supportBody.value ? '\n\n---\n' : who))
    window.location.href = `mailto:${useSupportEmail()}?subject=${subj}&body=${body}`
  }
  function mailToDonate(ex: { usdRate: any }) {
    const usd = donateSel.value
    const byn = ex.usdRate.value ? (usd * ex.usdRate.value).toFixed(2) + ' BYN' : `${usd}$`
    const subj = encodeURIComponent(`Донат UPin — $${usd} (~${byn})`)
    const body = encodeURIComponent(`Привет! Хочу задонатить $${usd} (~${byn}) разработчику UPin.\n\nПользователь: ${user.value.name} <${user.value.email}>\nТариф: ${user.value.plan || 'free'}\n\nСообщение:\n`)
    window.location.href = `mailto:${useSupportEmail()}?subject=${subj}&body=${body}`
  }
  return { supportSubject, supportBody, donateSel, setDonate, mailToSupport, mailToDonate }
}

export function useSettingsBioPreview(user: any) {
  const bioPreviewText = computed(() => ((user.value as any).bio || '').trim())
  const bioPreviewEmpty = computed(() => bioPreviewText.value.length === 0)
  return { bioPreviewText, bioPreviewEmpty }
}
