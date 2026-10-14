import { computed } from 'vue'
import { useTheme } from './useTheme'

export type AppearanceThemeValue = 'light' | 'dark' | 'system'

const OPTIONS: { v: AppearanceThemeValue; label: string; icon: string }[] = [
  { v: 'light', label: 'Светлая', icon: 'pi pi-sun' },
  { v: 'dark', label: 'Тёмная', icon: 'pi pi-moon' },
  { v: 'system', label: 'Система', icon: 'pi pi-desktop' },
]

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
   * Тумблер энергосбережения для v-model: чёрные поверхности вместо
   * тёмно-серых. Работает только поверх тёмной темы — в светлой
   * флаг тихо ждёт своего часа, ничего не перекрашивая.
   */
  const amoledOn = computed({
    get: () => amoled.value,
    set: (v: boolean) => setAmoled(v),
  })
  const amoledHint = computed(() =>
    !isDark.value
      ? 'Включится вместе с тёмной темой'
      : amoled.value
        ? 'Чёрный фон включён — экраны OLED отдыхают'
        : 'Чёрный фон вместо тёмно-серого',
  )

  return { options, active, hint, select, amoledOn, amoledHint }
}
