import { computed } from 'vue'
import { useTheme } from './useTheme'

export type AppearanceThemeValue = 'light' | 'dark' | 'system'

const OPTIONS: { v: AppearanceThemeValue; label: string; icon: string }[] = [
  { v: 'light', label: 'Светлая', icon: 'pi pi-sun' },
  { v: 'dark', label: 'Тёмная', icon: 'pi pi-moon' },
  { v: 'system', label: 'Система', icon: 'pi pi-desktop' },
]

/**
 * Хук вкладки «Внешний вид»: выбор темы и тумблер энергосбережения.
 *
 * @returns опции темы, актив, подписи, селект, v-model чёрного фона
 */
export function useAppearanceTheme() {
  const { theme, isDark, setTheme, systemDark, amoled, setAmoled } = useTheme()
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

  /**
   * Тумблер энергосбережения для v-model: чёрный фон вместо
   * тёмно-серого. Работает независимо от темы — включение
   * сразу даёт чёрный экран.
   *
   * @returns v-model тумблера и короткая подпись состояния
   */
  const amoledOn = computed({
    get: () => amoled.value,
    set: (v: boolean) => setAmoled(v),
  })
  const amoledHint = computed(() => (amoled.value ? 'Включено' : 'Выключено'))

  return { options, active, hint, select, amoledOn, amoledHint }
}
