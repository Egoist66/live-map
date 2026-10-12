import { ref } from 'vue'
import axios from 'axios'

/**
 * Глобальный тумблер ИИ в админке (только полные админы).
 *
 * Пока выключен — обычные пользователи не видят гид, AI-анкету
 * и разбор профиля нигде. Staff видит ИИ всегда (тест без палева).
 *
 * @returns состояние тумблера и экшены загрузки/сохранения
 * @example const ai = useAdminAi(); await ai.load()
 */
export function useAdminAi() {
  const enabled = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const loaded = ref(false)

  /**
   * Загрузить текущее состояние с сервера.
   */
  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const response = await axios.get('/api/admin/ai')
      enabled.value = response.data?.enabled === true
      loaded.value = true
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      error.value = e.response?.data?.message ?? 'Не удалось загрузить статус ИИ'
    } finally {
      loading.value = false
    }
  }

  /**
   * Переключить ИИ глобально.
   *
   * @param next новое состояние
   */
  async function setEnabled(next: boolean): Promise<void> {
    if (saving.value) return
    saving.value = true
    error.value = null
    notice.value = null
    try {
      const response = await axios.put('/api/admin/ai', { enabled: next })
      enabled.value = response.data?.enabled === true
      notice.value = enabled.value
        ? 'ИИ включён: пользователи видят гида и AI-анкету.'
        : 'ИИ выключен: пользователи ничего ИИшного не видят.'
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      error.value = e.response?.data?.message ?? 'Не удалось сохранить статус ИИ'
    } finally {
      saving.value = false
    }
  }

  return { enabled, loading, saving, error, notice, loaded, load, setEnabled }
}
