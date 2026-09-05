import { computed } from 'vue'
import { useTheme } from './useTheme'

export type AppearanceThemeValue = 'light' | 'dark' | 'system'

const OPTIONS: { v: AppearanceThemeValue; label: string; icon: string }[] = [
  { v: 'light', label: 'Светлая', icon: 'pi pi-sun' },
  { v: 'dark', label: 'Тёмная', icon: 'pi pi-moon' },
  { v: 'system', label: 'Система', icon: 'pi pi-desktop' },
]

export function useAppearanceTheme() {
  const { theme, isDark, setTheme, systemDark } = useTheme()
  const options = OPTIONS
  const active = computed(() => theme.value)
  const hint = computed(() =>
    theme.value === 'system'
      ? systemDark.value
        ? 'Следует системе — сейчас тёмная'
        : 'Следует системе — сейчас светлая'
      : isDark.value
        ? 'Тёмная тема включена'
        : 'Светлая тема включена',
  )

  function select(v: AppearanceThemeValue) {
    setTheme(v)
  }

  return { options, active, hint, select }
}
