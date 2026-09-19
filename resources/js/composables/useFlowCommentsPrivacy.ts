import { ref } from 'vue'
import { flowApi } from '@/services/flow.api'

/**
 * Приватность комментариев постов UFlow: кто может комментировать.
 *
 * Общая настройка для всех пользователей (как у фото):
 * everyone — все, friends — только друзья, none — никто.
 * Автор и админ пишут всегда. Значение живёт в auth.user.
 *
 * @param initial начальное значение из профиля
 * @example
 * const flowPrivacy = useFlowCommentsPrivacy(() => user.flow_comments_privacy)
 * await flowPrivacy.save('friends')
 */
export const FLOW_COMMENTS_OPTIONS = [
  { label: 'Все могут комментировать', value: 'everyone', icon: 'pi pi-globe' },
  { label: 'Только друзья', value: 'friends', icon: 'pi pi-users' },
  { label: 'Никто', value: 'none', icon: 'pi pi-lock' },
]

export function useFlowCommentsPrivacy(initial: () => string) {
  const value = ref<string>(initial() || 'everyone')
  const saving = ref(false)
  const error = ref<string | null>(null)
  const saved = ref(false)

  /**
   * Сохранить настройку на сервере.
   * @param v everyone|friends|none
   */
  async function save(v: string): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const res = await flowApi.updateCommentsPrivacy(v)
      value.value = res.flow_comments_privacy
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = detail || 'Не удалось сохранить'
    } finally {
      saving.value = false
    }
  }

  /**
   * Подтянуть значение из свежих пропсов.
   * @param v значение из профиля
   */
  function sync(v: string): void {
    value.value = v || 'everyone'
  }

  return { options: FLOW_COMMENTS_OPTIONS, value, saving, error, saved, save, sync }
}
