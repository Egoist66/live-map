import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { aiApi, type QuestionnaireDraft } from '@/services/ai.api'
import { planOf } from '@/composables/usePlanLimits'
import { useAiEnabled } from '@/composables/useAiEnabled'

/**
 * AI-генерация черновика дейтинг-анкеты по промпту (Premium и выше).
 *
 * Видимость — СТРОГО по флагу админки `ai.enabled` (без staff-обхода):
 * пока тумблер выключен, блок «AI-анкета» не видит никто, включая staff.
 * Как у всех ИИ-фич: свой велосипед для флага не нужен.
 * Пользователь описывает желаемую анкету своими словами, бэкенд
 * модерирует промпт, генерирует черновик через OpenRouter и модерирует
 * результат. Черновик возвращается в форму — человек правит поля
 * и сохраняет сам обычной кнопкой.
 *
 * @example
 * const gen = useQuestionnaireAi()
 * const draft = await gen.generate('люблю походы, ищу девушку')
 * if (draft) applyDraft(draft)
 */
export function useQuestionnaireAi() {
  const prompt = ref('')
  const generating = ref(false)
  const error = ref<string | null>(null)

  const { isAiEnabled } = useAiEnabled()

  /** Алиас под старым именем: форма читает `ai.aiVisible`. */
  const aiVisible = isAiEnabled

  const authUser = computed(
    () => (usePage().props.auth as { user?: { effective_plan?: string; plan?: string } | null } | undefined)?.user ?? null,
  )

  /** Генерация доступна Premium и выше только при включённом тумблере ИИ. */
  const canUse = computed(() => {
    if (!aiVisible.value) return false
    const plan = planOf(authUser.value)
    return plan === 'premium' || plan === 'business'
  })

  const promptLeft = computed(() => 500 - prompt.value.trim().length)

  /**
   * Сгенерировать черновик по текущему промпту.
   *
   * @returns черновик либо null при ошибке (текст в error)
   */
  async function generate(): Promise<QuestionnaireDraft | null> {
    const text = prompt.value.trim()

    if (text.length < 3 || generating.value) {
      return null
    }

    generating.value = true
    error.value = null

    try {
      return await aiApi.draftQuestionnaire(text)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не вышло сгенерировать — попробуй ещё раз'
      return null
    } finally {
      generating.value = false
    }
  }

  return { prompt, generating, error, canUse, aiVisible, promptLeft, generate }
}
