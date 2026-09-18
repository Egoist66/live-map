import { computed, ref } from 'vue'
import { formatScheduleCountdown, formatScheduleDate, isScheduledPin } from '@/composables/useScheduledPins'

/**
 * Табы раздела «Мои пины»: все пины и запланированные на будущее.
 *
 * Запланированные отбираются из уже загруженного списка `mine`
 * (бэк отдаёт `active + scheduled`), сортируются по `publish_at`
 * по возрастанию — ближайшая публикация первой.
 * Компонент только отображает состояние хука.
 *
 * @param getPins геттер полного списка пинов пользователя
 * @returns состояние табов, отфильтрованные списки и форматтеры дат
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const props = defineProps<{ pins: any[] }>()
 * const tabs = useMyPinsTabs(() => props.pins)
 * </script>
 * ```
 */
export function useMyPinsTabs(getPins: () => any[]) {
  const activeTab = ref<'all' | 'scheduled'>('all')

  const allPins = computed(() => getPins() ?? [])

  const scheduledPins = computed(() => {
    const onlyScheduled = allPins.value.filter((pin) => isScheduledPin(pin))

    return onlyScheduled
      .slice()
      .sort((a, b) => +new Date(a?.publish_at ?? 0) - +new Date(b?.publish_at ?? 0))
  })

  const activeCount = computed(() => allPins.value.length)
  const scheduledCount = computed(() => scheduledPins.value.length)

  const visiblePins = computed(() => (activeTab.value === 'scheduled' ? scheduledPins.value : allPins.value))

  /**
   * Переключает таб пинов.
   *
   * @param tab таб для показа
   */
  function setTab(tab: 'all' | 'scheduled'): void {
    activeTab.value = tab
  }

  return {
    activeTab,
    setTab,
    visiblePins,
    scheduledPins,
    activeCount,
    scheduledCount,
    isScheduledPin,
    scheduleDateLabel: formatScheduleDate,
    scheduleCountdownLabel: formatScheduleCountdown,
  }
}
