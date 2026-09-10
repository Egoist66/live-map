import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { datingApi } from '@/services/dating.api'
import { datingQuestionnaireSchema } from '@/validation/schemas/dating.schema'

/**
 * Анкета ULove: создание и редактирование «о себе».
 *
 * Читает стартовые значения из auth-пользователя, валидирует
 * через zod и сохраняет через PATCH /api/swipes/settings.
 * Свои тексты дополнительно чистит модерация на бэке.
 *
 * @example
 * const { goal, customGoal, about, interests, save } = useDatingQuestionnaire()
 * await save()
 */
export function useDatingQuestionnaire() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  const enabled = ref(true)
  const goal = ref<string | null>(null)
  const customGoal = ref('')
  const about = ref('')
  const interests = ref<string[]>([])
  const interestInput = ref('')
  const saving = ref(false)
  const errors = ref<Record<string, string>>({})
  const serverError = ref<string | null>(null)

  function resetFromUser(): void {
    const u = authUser.value
    enabled.value = u?.dating_enabled ?? true
    goal.value = u?.dating_goal ?? null
    customGoal.value = u?.dating_custom_goal ?? ''
    about.value = u?.dating_about ?? ''
    const raw = u?.dating_interests ?? []
    interests.value = Array.isArray(raw) ? raw.slice(0, 10) : []
    interestInput.value = ''
    errors.value = {}
    serverError.value = null
  }

  const goalShort = computed(() => {
    const custom = customGoal.value.trim()
    if (custom) return custom
    const map: Record<string, string> = {
      love: 'Ищу отношения',
      flirt: 'Ищу флирт',
      friendship: 'Ищу дружбу',
      chat: 'Ищу общение',
      interests: 'Ищу по интересам',
    }
    return map[goal.value ?? ''] ?? 'Цель не указана'
  })

  const aboutLeft = computed(() => 1000 - about.value.length)
  const customLeft = computed(() => 60 - customGoal.value.trim().length)

  function addInterest(raw: string): void {
    const tag = raw.trim().toLowerCase().slice(0, 40)
    if (!tag || interests.value.includes(tag) || interests.value.length >= 10) return
    interests.value = [...interests.value, tag]
    interestInput.value = ''
  }

  function removeInterest(tag: string): void {
    interests.value = interests.value.filter((t) => t !== tag)
  }

  function togglePreset(tag: string): void {
    if (interests.value.includes(tag)) removeInterest(tag)
    else addInterest(tag)
  }

  /**
   * Сохранить анкету.
   *
   * @returns true если сохранено
   */
  async function save(): Promise<boolean> {
    errors.value = {}
    serverError.value = null
    const parsed = datingQuestionnaireSchema.safeParse({
      dating_enabled: enabled.value,
      dating_goal: goal.value,
      dating_custom_goal: customGoal.value.trim() ? customGoal.value.trim() : null,
      dating_about: about.value.trim() ? about.value.trim() : null,
      dating_interests: interests.value,
    })
    if (!parsed.success) {
      const flat: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        const key = String(i.path[0] ?? 'form')
        if (!flat[key]) flat[key] = i.message
      })
      errors.value = flat
      return false
    }
    saving.value = true
    try {
      const saved = await datingApi.updateSettings({
        dating_enabled: enabled.value,
        dating_goal: goal.value,
        dating_custom_goal: parsed.data.dating_custom_goal,
        dating_about: parsed.data.dating_about,
        dating_interests: parsed.data.dating_interests ?? [],
      })
      const u = authUser.value
      if (u && saved) Object.assign(u, saved)
      return true
    } catch (e: any) {
      serverError.value = e?.response?.data?.message ?? 'Не удалось сохранить анкету'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    enabled,
    goal,
    customGoal,
    about,
    interests,
    interestInput,
    saving,
    errors,
    serverError,
    goalShort,
    aboutLeft,
    customLeft,
    resetFromUser,
    addInterest,
    removeInterest,
    togglePreset,
    save,
  }
}
