import { ref } from 'vue'
import { api } from '@/services/api'

const code = ref('')
const expiresIn = ref(0)
const loading = ref(false)
const errorMessage = ref('')

/**
 * Код для переключения Telegram-бота на этот аккаунт.
 *
 * Сценарий: у человека два аккаунта (сайт + Telegram). Здесь он генерирует
 * 6 цифр, затем присылает их боту (/switch или кнопка «Переключиться») —
 * привязка переезжает сюда. Вся логика здесь (Правило №1): компонент только
 * показывает код и дёргает generateSwitchCode.
 *
 * @example
 * ```ts
 * const { code, generateSwitchCode } = useTelegramAccount()
 * await generateSwitchCode()
 * ```
 *
 * @returns код, состояние загрузки и метод генерации
 */
export function useTelegramAccount() {
  /**
   * Сгенерировать новый одноразовый код (старый сгорает).
   *
   * @returns true когда код получен
   */
  async function generateSwitchCode(): Promise<boolean> {
    if (loading.value) return false
    loading.value = true
    errorMessage.value = ''
    try {
      const response = await api.post('/api/telegram/switch-code')
      const data = response.data ?? {}
      code.value = typeof data.code === 'string' ? data.code : ''
      expiresIn.value = Number(data.expires_in ?? 0)
      return code.value !== ''
    } catch {
      errorMessage.value = 'Не получилось сгенерировать код. Попробуйте ещё раз.'
      return false
    } finally {
      loading.value = false
    }
  }

  /** Убрать код с экрана (например, после переключения). */
  function clearCode(): void {
    code.value = ''
    expiresIn.value = 0
    errorMessage.value = ''
  }

  return { code, expiresIn, loading, errorMessage, generateSwitchCode, clearCode }
}
