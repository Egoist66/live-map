import { computed, ref } from 'vue'
import { useQuestStore } from '@/stores/quests'

/**
 * Игровая логика раздела «Задания»: табы треков, прогресс, модалка PRO.
 *
 * Компонент только отображает: вся логика — здесь.
 * @returns состояние вкладок, выбранный трек и действия
 * @example
 * const q = useQuests()
 * await q.init()
 */
export function useQuests() {
  const store = useQuestStore()
  const activeTrack = ref<'pins' | 'swipes'>('pins')
  const showPremiumModal = computed(() => store.justGranted !== null)

  const track = computed(() => (activeTrack.value === 'pins' ? store.pins : store.swipes))
  const claimInfo = computed(() => store.state?.can_claim?.[activeTrack.value] ?? { allowed: false, reason: null })

  const overallPercent = computed(() => {
    const t = track.value
    if (!t) return 0
    const total = t.quests.reduce((s, q) => s + q.target, 0)
    const done = t.quests.reduce((s, q) => s + Math.min(q.progress, q.target), 0)
    return total ? Math.round((done / total) * 100) : 0
  })

  const trackMeta = computed(() => ({
    pins: { label: 'Пины · ULove', icon: 'pi pi-map-marker', hint: 'Для организаторов встреч' },
    swipes: { label: 'Свайпы · ULove', icon: 'pi pi-heart-fill', hint: 'Для знакомств' },
  }))

  /**
   * Первичная загрузка заданий.
   */
  async function init(): Promise<void> {
    if (!store.state && !store.loading) await store.load()
  }

  /**
   * Выбрать трек.
   * @param t pins|swipes
   */
  function selectTrack(t: 'pins' | 'swipes'): void {
    activeTrack.value = t
  }

  /**
   * Забрать PRO за активный трек.
   * @returns true если выдано
   */
  async function claimActive(): Promise<boolean> {
    return store.claim(activeTrack.value)
  }

  return {
    store,
    activeTrack,
    track,
    claimInfo,
    overallPercent,
    trackMeta,
    showPremiumModal,
    init,
    selectTrack,
    claimActive,
  }
}
