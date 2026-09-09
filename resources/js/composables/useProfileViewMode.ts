import { ref } from 'vue'

/** Режим отображения профиля: social — новый (по умолчанию), classic — прежний. */
export type ProfileViewMode = 'social' | 'classic'

const STORAGE_KEY = 'live-map:profile-view'

/**
 * Читает сохранённый режим из localStorage.
 * @returns сохранённый режим или social по умолчанию
 */
function readMode(): ProfileViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'classic' || raw === 'social') return raw
  } catch {}
  return 'social'
}

/**
 * Переключатель вида профиля: новый социальный (по умолчанию) / классический.
 * Выбор сохраняется между визитами.
 * @returns текущий режим и действия
 * @example
 * const { mode, isSocial, toggle } = useProfileViewMode()
 */
export function useProfileViewMode() {
  const mode = ref<ProfileViewMode>(readMode())

  /**
   * Устанавливает режим и сохраняет выбор.
   * @param next новый режим
   */
  function setMode(next: ProfileViewMode): void {
    mode.value = next
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }

  /**
   * Переключает social <-> classic.
   */
  function toggle(): void {
    setMode(mode.value === 'social' ? 'classic' : 'social')
  }

  return { mode, setMode, toggle }
}
