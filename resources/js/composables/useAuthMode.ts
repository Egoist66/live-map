import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Режим единого экрана входа (`Auth/Login`): `login` или `register`.
 */
export type AuthMode = 'login' | 'register'

/**
 * Состояние тоггла «Вход / Регистрация» на едином роуте `login`.
 *
 * Начальный режим приходит пропсом со страницы (бэкенд кладёт туда
 * query `?mode=register`), переключение меняет только локальный ref
 * и query в адресной строке через `history.replaceState` — без лишних
 * Inertia-запросов, состояние обеих форм сохраняется. Кнопки браузера
 * «назад/вперёд» отслеживаются через `popstate`.
 *
 * @param initial начальный режим от бэкенда (`login` по умолчанию)
 * @returns режим, направление анимации и экшены переключения
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const props = defineProps<{ mode?: AuthMode }>()
 * const { mode, isLogin, showRegister, transitionName } = useAuthMode(props.mode)
 * </script>
 * ```
 */
export function useAuthMode(initial: AuthMode = 'login') {
  const fallback: AuthMode = initial === 'register' ? 'register' : 'login'
  const mode = ref<AuthMode>(readModeFromUrl() ?? fallback)
  const direction = ref<1 | -1>(mode.value === 'register' ? 1 : -1)

  const isLogin = computed(() => mode.value === 'login')
  const isRegister = computed(() => mode.value === 'register')

  /**
   * Имя Vue-перехода для форм: вправо — к регистрации,
   * влево — обратно ко входу.
   */
  const transitionName = computed(() => (direction.value >= 0 ? 'auth-swap-r' : 'auth-swap-l'))

  /**
   * Читать режим из query адресной строки.
   *
   * @returns режим из URL или null
   */
  function readModeFromUrl(): AuthMode | null {
    if (typeof window === 'undefined') {
      return null
    }

    const raw = new URLSearchParams(window.location.search).get('mode')

    if (raw === 'register' || raw === 'login') {
      return raw
    }

    return null
  }

  /**
   * Отразить режим в адресной строке без перезагрузки.
   *
   * @param next новый режим
   */
  function syncUrl(next: AuthMode): void {
    if (typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)

    if (next === 'register') {
      url.searchParams.set('mode', 'register')
    } else {
      url.searchParams.delete('mode')
    }

    window.history.replaceState(null, '', url.toString())
  }

  /**
   * Переключить режим с направлением для анимации.
   *
   * @param next новый режим
   */
  function setMode(next: AuthMode): void {
    if (mode.value === next) {
      return
    }

    direction.value = next === 'register' ? 1 : -1
    mode.value = next
    syncUrl(next)
  }

  /**
   * Показать форму входа.
   */
  function showLogin(): void {
    setMode('login')
  }

  /**
   * Показать форму регистрации.
   */
  function showRegister(): void {
    setMode('register')
  }

  /**
   * Синхронизировать режим с кнопками браузера назад/вперёд.
   */
  function onPopState(): void {
    const fromUrl = readModeFromUrl()

    if (fromUrl && fromUrl !== mode.value) {
      direction.value = fromUrl === 'register' ? 1 : -1
      mode.value = fromUrl
    }
  }

  onMounted(() => {
    syncUrl(mode.value)
    window.addEventListener('popstate', onPopState)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState)
  })

  return { mode, direction, isLogin, isRegister, transitionName, setMode, showLogin, showRegister }
}
