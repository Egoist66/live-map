import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { claimQuestPremium, fetchQuests, refreshQuests, type QuestState } from '@/services/quests.api'

/**
 * Стор заданий: треки пинов/свайпов, рейтинг, PRO-неделя.
 */
export const useQuestStore = defineStore('quests', () => {
  const state = ref<QuestState | null>(null)
  const loading = ref(false)
  const claiming = ref<'' | 'pins' | 'swipes'>('')
  const error = ref<string | null>(null)
  const justGranted = ref<{ track: string; premium_until: string; cooldown_until: string } | null>(null)

  const pins = computed(() => state.value?.tracks?.pins ?? null)
  const swipes = computed(() => state.value?.tracks?.swipes ?? null)
  const rating = computed(() => state.value?.rating ?? null)
  const onCooldown = computed(() => !!state.value?.on_cooldown)
  const isPremium = computed(() => !!state.value?.is_premium)

  /**
   * Загрузить состояние заданий.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      state.value = await fetchQuests()
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось загрузить задания'
    } finally {
      loading.value = false
    }
  }

  /**
   * Пересчитать прогресс.
   */
  async function refresh(): Promise<void> {
    try {
      state.value = await refreshQuests()
    } catch {}
  }

  /**
   * Забрать PRO за трек.
   * @param track pins|swipes
   * @returns true если выдано
   */
  async function claim(track: 'pins' | 'swipes'): Promise<boolean> {
    claiming.value = track
    error.value = null
    try {
      const res = await claimQuestPremium(track)
      justGranted.value = {
        track,
        premium_until: res.premium_until,
        cooldown_until: res.cooldown_until,
      }
      await load()
      return true
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Забрать PRO пока нельзя'
      return false
    } finally {
      claiming.value = ''
    }
  }

  function closeGranted(): void {
    justGranted.value = null
  }

  return { state, pins, swipes, rating, onCooldown, isPremium, loading, claiming, error, justGranted, load, refresh, claim, closeGranted }
})
