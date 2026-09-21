import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

/**
 * Состояние автоответа «меня нет онлайн».
 *
 * Когда включено и тебя нет в сети (last_seen старше 3 минут),
 * собеседник в личном диалоге получает дефолтное сообщение
 * «я пока не онлайн, пообщаемся позже», а тебе на email из
 * аккаунта приходит пинг о новом сообщении.
 *
 * @returns состояние, загрузка и сохранение автоответа
 *
 * @example
 * const autoReply = useChatAutoReply()
 * await autoReply.load()
 * await autoReply.save(true, 'Отвечу вечером!')
 */
export function useChatAutoReply() {
  const enabled = ref(false)
  const text = ref('')
  const defaultText = ref('')
  const hasEmail = ref(true)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  /**
   * Загрузить настройки автоответа с сервера.
   */
  async function load(): Promise<void> {
    if (loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const res = await chatApi.getAutoReply()

      enabled.value = !!res.enabled
      text.value = res.text ?? ''
      defaultText.value = res.default_text ?? ''
      hasEmail.value = res.has_email ?? true
      loaded.value = true
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось загрузить автоответ'

      error.value = msg
    } finally {
      loading.value = false
    }
  }

  /**
   * Сохранить настройки автоответа.
   *
   * @param nextEnabled включить или выключить
   * @param nextText свой текст (пусто = дефолтный)
   * @returns true если сохранено
   */
  async function save(nextEnabled: boolean, nextText: string): Promise<boolean> {
    if (saving.value) {
      return false
    }

    saving.value = true
    error.value = null

    try {
      const trimmed = nextText.trim()
      const res = await chatApi.updateAutoReply({ enabled: nextEnabled, text: trimmed === '' ? null : trimmed.slice(0, 500) })

      enabled.value = !!res.enabled
      text.value = res.text ?? ''
      defaultText.value = res.default_text ?? defaultText.value
      hasEmail.value = res.has_email ?? true

      return true
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.text?.[0] || e?.message || 'Не удалось сохранить автоответ'

      error.value = msg

      return false
    } finally {
      saving.value = false
    }
  }

  return {
    enabled,
    text,
    defaultText,
    hasEmail,
    loading,
    saving,
    error,
    loaded,
    load,
    save,
  }
}
