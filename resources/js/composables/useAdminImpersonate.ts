import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { adminApi } from '@/services/admin.api'

export function useAdminImpersonate() {
  const page = usePage()
  const target = ref<any | null>(null)
  const reason = ref('')
  const confirmed = ref(false)
  const loading = ref(false)
  const stopping = ref(false)
  const error = ref<string | null>(null)

  const isImpersonating = computed(() => !!(page.props.auth as any)?.impersonating)
  const open = computed(() => !!target.value)
  const reasonValid = computed(() => reason.value.trim().length >= 10)
  const canSubmit = computed(() => reasonValid.value && confirmed.value && !loading.value)

  function ask(user: any) {
    target.value = user
    reason.value = ''
    confirmed.value = false
    error.value = null
  }

  function close() {
    if (loading.value) return
    target.value = null
    error.value = null
  }

  async function submit() {
    if (!target.value || !canSubmit.value) return
    loading.value = true
    error.value = null
    try {
      await adminApi.impersonate(target.value.id, { reason: reason.value.trim(), confirmed: true })
      window.location.href = '/profile'
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось войти в аккаунт'
    } finally {
      loading.value = false
    }
  }

  async function stop() {
    stopping.value = true
    error.value = null
    try {
      await adminApi.stopImpersonation()
      window.location.href = '/admin'
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось вернуться'
    } finally {
      stopping.value = false
    }
  }

  return { target, reason, confirmed, loading, stopping, error, isImpersonating, open, reasonValid, canSubmit, ask, close, submit, stop }
}
