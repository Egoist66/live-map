import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'

/**
 * Защита от дозвонов: если я отклонил звонок, тот же человек
 * не сможет перезвонить мне 5 минут. По умолчанию выключена —
 * без неё повторный звонок проходит сразу.
 *
 * Начальное значение берётся из общих пропсов страницы
 * (`auth.user.call_cooldown_enabled`) и правится PATCH-ем.
 *
 * @example
 * const calls = useCallCooldown()
 * <ToggleSwitch :modelValue="calls.enabled.value" @update:modelValue="calls.toggle" />
 */
export function useCallCooldown() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user)
  const enabled = ref<boolean>(!!user.value?.call_cooldown_enabled)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Включить или выключить защиту от дозвонов.
   *
   * @param value новое значение переключателя
   */
  async function toggle(value: boolean): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await axios.patch('/api/user/call-cooldown', { call_cooldown_enabled: value })
      enabled.value = !!data.call_cooldown_enabled
      syncPageUser(enabled.value)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Не удалось сохранить настройку звонков'
    } finally {
      loading.value = false
    }
  }

  /**
   * Подтянуть значение из свежих пропсов (смена пользователя и т.п.).
   *
   * @param value значение из `auth.user.call_cooldown_enabled`
   */
  function sync(value: boolean): void {
    enabled.value = !!value
  }

  /**
   * Прописать значение в общие пропсы, чтобы пережило навигацию.
   *
   * @param value включён ли кулдаун
   */
  function syncPageUser(value: boolean): void {
    try {
      if (user.value) user.value.call_cooldown_enabled = value
      const w = window as unknown as { __inertia_page?: { props?: { auth?: { user?: Record<string, unknown> } } } }
      const shared = w.__inertia_page?.props?.auth?.user
      if (shared) shared.call_cooldown_enabled = value
    } catch {}
  }

  return { enabled, loading, error, toggle, sync }
}
