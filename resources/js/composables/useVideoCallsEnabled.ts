import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'

/**
 * Приём голосовых звонков: выключено — не дозвонится никто, даже друзья
 * и мэтчи. Исходящие звонки остаются доступны. По умолчанию включено.
 *
 * Начальное значение берётся из общих пропсов страницы
 * (`auth.user.video_calls_enabled`) и правится PATCH-ем.
 *
 * @example
 * const video = useVideoCallsEnabled()
 * <ToggleSwitch :modelValue="video.enabled.value" @update:modelValue="video.toggle" />
 */
export function useVideoCallsEnabled() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user)
  const enabled = ref<boolean>(user.value?.video_calls_enabled ?? true)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
    * Включить или выключить приём голосовых звонков.
   *
   * @param value новое значение переключателя
   */
  async function toggle(value: boolean): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await axios.patch('/api/user/video-calls', { video_calls_enabled: value })
      enabled.value = !!data.video_calls_enabled
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
   * @param value значение из `auth.user.video_calls_enabled`
   */
  function sync(value: boolean): void {
    enabled.value = !!value
  }

  /**
   * Прописать значение в общие пропсы, чтобы пережило навигацию.
   *
   * @param value включён ли приём
   */
  function syncPageUser(value: boolean): void {
    try {
      if (user.value) user.value.video_calls_enabled = value
      const w = window as unknown as { __inertia_page?: { props?: { auth?: { user?: Record<string, unknown> } } } }
      const shared = w.__inertia_page?.props?.auth?.user
      if (shared) shared.video_calls_enabled = value
    } catch {}
  }

  return { enabled, loading, error, toggle, sync }
}
