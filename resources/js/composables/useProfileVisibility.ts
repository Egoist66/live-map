import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'
import { useToast } from 'primevue/usetoast'

/**
 * Глаз «скрыть / показать» профиль из публичного доступа.
 *
 * Временное скрытие анкеты и профиля без удаления аккаунта:
 * никто не видит страницу и анкету в ленте, возврат — одним
 * тапом. Доступно всем тарифам (бэк-гейта нет).
 *
 * @returns состояние скрытия, загрузка и переключение
 * @example
 * const visibility = useProfileVisibility()
 * onMounted(() => visibility.load())
 */
export function useProfileVisibility() {
  const page = usePage()

  let toast: ReturnType<typeof useToast> | null = null
  try {
    toast = useToast()
  } catch {
    toast = null
  }

  const state = ref({
    hidden: false,
    loaded: false,
    toggling: false,
    error: null as string | null,
  })

  const hidden = computed(() => state.value.hidden)
  const toggling = computed(() => state.value.toggling)

  /** Иконка глаза под текущее состояние. */
  const eyeIcon = computed(() => (state.value.hidden ? 'pi pi-eye-slash' : 'pi pi-eye'))

  /** Подсказка глаза под текущее состояние. */
  const eyeTitle = computed(() =>
    state.value.hidden
      ? 'Анкета скрыта — нажми, чтобы вернуть в поиск'
      : 'Скрыть анкету и профиль из публичного доступа',
  )

  /**
   * Подтянуть текущий статус скрытия с бэка.
   */
  async function load(): Promise<void> {
    try {
      const { data } = await axios.get('/api/account/status')
      state.value.hidden = !!data?.hidden
      syncAuth(!!data?.hidden)
    } catch {
      /* тихий фолбэк: глаз просто не покажет скрытие */
    } finally {
      state.value.loaded = true
    }
  }

  /**
   * Переключить скрытие (скрыть ↔ показать).
   */
  async function toggle(): Promise<void> {
    if (state.value.toggling) {
      return
    }

    state.value.toggling = true
    state.value.error = null

    try {
      const endpoint = state.value.hidden ? '/api/account/show' : '/api/account/hide'
      const { data } = await axios.post(endpoint)
      state.value.hidden = !!data?.hidden
      syncAuth(state.value.hidden)
      toast?.add({
        severity: 'success',
        summary: state.value.hidden ? 'Анкета скрыта 🙈' : 'Анкета снова видна 👀',
        detail: state.value.hidden
          ? 'Профиль и анкета убраны из публичного доступа. Аккаунт цел.'
          : 'Профиль и анкета вернулись в поиск и ленту.',
        life: 3500,
      })
    } catch {
      state.value.error = 'Не получилось переключить — попробуй ещё раз'
      toast?.add({ severity: 'error', summary: 'Не вышло', detail: state.value.error, life: 3000 })
    } finally {
      state.value.toggling = false
    }
  }

  /**
   * Зеркалить флаг в auth-пользователя страницы.
   *
   * @param value скрыта ли анкета
   */
  function syncAuth(value: boolean): void {
    try {
      const user = (page.props.auth as any)?.user
      if (user) {
        user.profile_hidden_at = value ? new Date().toISOString() : null
      }
    } catch {
      /* noop */
    }
  }

  return { state, hidden, toggling, eyeIcon, eyeTitle, load, toggle }
}
