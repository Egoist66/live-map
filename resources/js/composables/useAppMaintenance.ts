import { ref } from 'vue'
import { adminApi } from '@/services/admin.api'

export function useAppMaintenance() {
  const enabled = ref(false)
  const title = ref('')
  const message = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const d: any = await adminApi.maintenance()
      enabled.value = !!d.enabled
      title.value = d.title ?? ''
      message.value = d.message ?? ''
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить настройки'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    error.value = null
    try {
      const d: any = await adminApi.updateMaintenance({
        enabled: enabled.value,
        title: title.value.trim() || 'Технические работы',
        message: message.value.trim(),
      })
      enabled.value = !!d.enabled
      title.value = d.title ?? ''
      message.value = d.message ?? ''
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось сохранить'
      throw e
    } finally {
      saving.value = false
    }
  }

  function canSave() {
    return title.value.trim().length >= 3
  }

  return { enabled, title, message, loading, saving, error, load, save, canSave }
}
