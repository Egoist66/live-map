import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { datingApi } from '@/services/dating.api'
import { datingQuestionnaireSchema } from '@/validation/schemas/dating.schema'
import { isUnchangedPayload } from '@/composables/useUnchangedGuard'
import { emitDatingSaved } from '@/composables/useDatingSavedSync'
import { useContentModeration } from '@/composables/useContentModeration'
import { useFileDownload } from '@/composables/useFileDownload'

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
  const moderator = useContentModeration()
  const { download } = useFileDownload()

  const enabled = ref(true)
  const goal = ref<string | null>(null)
  const customGoal = ref('')
  const about = ref('')
  const interests = ref<string[]>([])
  const interestInput = ref('')
  const saving = ref(false)
  const exporting = ref(false)
  const importing = ref(false)
  const errors = ref<Record<string, string>>({})
  const serverError = ref<string | null>(null)
  const transferError = ref<string | null>(null)
  /** Предупреждение модерации рядом с интересами (локально или с сервера). */
  const moderationWarning = ref<string | null>(null)
  /** Последний сохранённый payload — форма пробрасывает его в emit('saved'). */
  const lastSaved = ref<Record<string, any> | null>(null)

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
    transferError.value = null
    moderationWarning.value = null
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

  /**
   * Развернуть errors из Laravel в плоскую карту «поле → первое сообщение».
   *
   * @param raw блок errors из ответа API
   * @returns ошибки по полям
   */
  function flattenErrors(raw: unknown): Record<string, string> {
    const flat: Record<string, string> = {}

    if (!raw || typeof raw !== 'object') {
      return flat
    }

    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const first = Array.isArray(value) ? value[0] : value

      if (typeof first === 'string' && first !== '') {
        flat[key] = first
      }
    }

    return flat
  }

  /**
   * Добавить интерес с локальной проверкой нецензурной лексики.
   *
   * Темы (политика, 18+ и т.д.) окончательно проверяет сервер при
   * сохранении — там же показываем его предупреждение у интересов.
   *
   * @param raw введённый или предустановленный интерес
   * @returns void
   */
  function addInterest(raw: string): void {
    const tag = raw.trim().toLowerCase().slice(0, 40)
    if (!tag || interests.value.includes(tag) || interests.value.length >= 10) return

    const blockReason = moderator.assertPublishable(tag)

    if (blockReason) {
      moderationWarning.value = `Интерес «${tag}» не прошёл модерацию: ${blockReason}`
      return
    }

    moderationWarning.value = null
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
    const blockReason = moderator.assertPublishable(
      [parsed.data.dating_custom_goal, parsed.data.dating_about, ...(parsed.data.dating_interests ?? [])]
        .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        .join(' '),
    )
    if (blockReason) {
      serverError.value = blockReason
      moderationWarning.value = blockReason
      return false
    }
    const origin = authUser.value ?? {}
    const unchanged = isUnchangedPayload(
      {
        dating_enabled: enabled.value,
        dating_goal: goal.value,
        dating_custom_goal: parsed.data.dating_custom_goal,
        dating_about: parsed.data.dating_about,
        dating_interests: parsed.data.dating_interests ?? [],
      },
      {
        dating_enabled: origin.dating_enabled ?? true,
        dating_goal: origin.dating_goal ?? null,
        dating_custom_goal: origin.dating_custom_goal ?? null,
        dating_about: origin.dating_about ?? null,
        dating_interests: origin.dating_interests ?? [],
      },
      ['dating_enabled', 'dating_goal', 'dating_custom_goal', 'dating_about', 'dating_interests'],
    )
    if (unchanged) {
      lastSaved.value = {
        dating_enabled: enabled.value,
        dating_goal: goal.value,
        dating_custom_goal: parsed.data.dating_custom_goal,
        dating_about: parsed.data.dating_about,
        dating_interests: parsed.data.dating_interests ?? [],
      }
      return true
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
      // Оптимистично — мгновенно для всех читателей auth.user,
      // затем сверяемся с сервером: прямая мутация пропсов хрупка
      // (часть экранов держит свои копии), reload доводит свежий
      // auth.user всем подписчикам без перезагрузки страницы.
      const u = authUser.value
      if (u && saved) Object.assign(u, saved)
      lastSaved.value = saved ?? null
      emitDatingSaved(saved)
      try {
        await router.reload({ only: ['auth'] })
      } catch {}
      resetFromUser()
      return true
    } catch (e: any) {
      const data = e?.response?.data
      const flat = flattenErrors(data?.errors)

      if (Object.keys(flat).length > 0) {
        errors.value = flat
      }

      const reason = flat.content ?? (typeof data?.message === 'string' ? data.message : null)

      if (flat.content) {
        moderationWarning.value = flat.content
      }

      serverError.value = reason ?? 'Не удалось сохранить анкету'

      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Скачать анкету JSON-файлом одним кликом.
   *
   * @returns true если браузер начал скачивание
   */
  async function exportQuestionnaire(): Promise<boolean> {
    if (exporting.value) {
      return false
    }

    exporting.value = true
    transferError.value = null

    try {
      const date = new Date().toISOString().slice(0, 10)
      const fileName = `ulove-anketa-${date}.json`
      const started = await download('/api/swipes/settings/export', fileName)

      if (!started) {
        transferError.value = 'Не удалось скачать анкету. Попробуйте ещё раз.'
        return false
      }

      return true
    } catch {
      transferError.value = 'Не удалось скачать анкету. Попробуйте ещё раз.'
      return false
    } finally {
      exporting.value = false
    }
  }

  /**
   * Импортировать анкету из JSON-файла и сразу сохранить.
   *
   * Файл проверяет сервер: формат, лимиты полей и модерация.
   * При успехе форма и все подписчики auth.user получают новые данные.
   *
   * @param file выбранный JSON-файл
   * @returns true если анкета загружена
   */
  async function importQuestionnaire(file: File): Promise<boolean> {
    if (importing.value) {
      return false
    }

    transferError.value = null
    moderationWarning.value = null

    if (!file.name.toLowerCase().endsWith('.json')) {
      transferError.value = 'Выберите файл анкеты ULove.'
      return false
    }

    if (file.size > 64 * 1024) {
      transferError.value = 'Файл анкеты больше 64 КБ.'
      return false
    }

    importing.value = true

    try {
      const saved = await datingApi.importSettings(file)
      const u = authUser.value

      if (u && saved) {
        Object.assign(u, saved)
      }

      lastSaved.value = saved ?? null
      emitDatingSaved(saved)
      try {
        await router.reload({ only: ['auth'] })
      } catch {}
      resetFromUser()

      return true
    } catch (e: any) {
      const data = e?.response?.data
      const flat = flattenErrors(data?.errors)

      if (Object.keys(flat).length > 0) {
        errors.value = flat
      }

      transferError.value = flat.file
        ?? flat.content
        ?? (typeof data?.message === 'string' ? data.message : null)
        ?? 'Не удалось импортировать анкету. Проверьте файл.'

      return false
    } finally {
      importing.value = false
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
    exporting,
    importing,
    errors,
    serverError,
    transferError,
    moderationWarning,
    lastSaved,
    goalShort,
    aboutLeft,
    customLeft,
    resetFromUser,
    addInterest,
    removeInterest,
    togglePreset,
    save,
    exportQuestionnaire,
    importQuestionnaire,
  }
}
