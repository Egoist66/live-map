import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Видимость системы очков и рангов за активность.
 *
 * Очки и ранги (Новичок…Гид) живут только с допразделами: пока
 * дефолт — чистый ULove, таб заданий и всё связанное скрыты.
 * Очки при этом копятся на бэке как обычно. Админ выпустил
 * карту/ленту/районы/бизнес — система появилась сама.
 *
 * @returns выпущена ли система активности
 * @example const activity = useActivitySystem()
 */
export function useActivitySystem() {
  const page = usePage()
  const store = useAppModulesStore()

  try {
    const raw = (page.props as unknown as { globalModules?: unknown }).globalModules

    if (raw !== undefined) {
      store.applyGlobal(raw)
    }
  } catch {
    // No-op: стор держит дефолт ['ulove'].
  }

  /** Выпущен ли хоть один раздел кроме базового ULove. */
  const isReleased = computed(
    () =>
      store.isGloballyEnabled('upin') ||
      store.isGloballyEnabled('uflow') ||
      store.isGloballyEnabled('districts') ||
      store.isGloballyEnabled('business'),
  )

  return { isReleased }
}
