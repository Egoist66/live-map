import { computed, onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { router } from '@inertiajs/vue3'
import { api } from '@/services/api'
import { onboardingSchema } from '@/validation/schemas/onboarding.schema'
import { useToast } from 'primevue/usetoast'

export interface OnboardingGoalOption {
  label: string
  value: 'love' | 'flirt' | 'friendship' | 'chat' | 'interests'
}

const GOAL_OPTIONS: OnboardingGoalOption[] = [
  { label: '💘 Отношения', value: 'love' },
  { label: '😉 Флирт', value: 'flirt' },
  { label: '🤝 Дружба', value: 'friendship' },
  { label: '💬 Общение', value: 'chat' },
  { label: '🎯 По интересам', value: 'interests' },
]

const GENDER_OPTIONS = [
  { label: '👨 Мужчина', value: 'male' },
  { label: '👩 Девушка', value: 'female' },
]

/**
 * Превратить дату в Y-m-d для бэка.
 *
 * @param value дата из DatePicker или ISO-строка
 * @returns Y-m-d либо null
 */
function toIsoDate(value: unknown): string | null {
  try {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear()
      const m = String(value.getMonth() + 1).padStart(2, '0')
      const d = String(value.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    if (typeof value === 'string' && value !== '') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return toIsoDate(parsed)
      }
    }
  } catch {
    // No-op: вернём null ниже.
  }
  return null
}

/**
 * Веб-анкета онбординга Mini App (страница /onboarding).
 *
 * Тот же набор, что в боте пошагово и в регистрации: имя, пол,
 * дата 18+, цель, город. Черновик подтягиваем из
 * GET /api/onboarding/status, сохраняем в POST /api/onboarding/complete —
 * бэк снимает флаг onboarding_only, дальше ведём в свайпы.
 * Компонент только рисует (Правило №1).
 *
 * @returns поля, опции, состояние и отправка формы
 * @example
 * const f = useOnboardingForm()
 * // <form @submit.prevent="f.submit">…</form>
 */
export function useOnboardingForm() {
  const loading = ref(true)
  const loadError = ref<string | null>(null)
  const alreadyComplete = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as any
    }
  })()

  const { defineField, handleSubmit, errors, values, isSubmitting, setErrors, setValues } = useForm({
    validationSchema: onboardingSchema,
    initialValues: {
      name: '',
      gender: null,
      birth_date: null,
      dating_goal: null,
      home_city: null,
    } as any,
  })

  const [name, nameAttrs] = defineField('name')
  const [gender] = defineField('gender')
  const [dating_goal] = defineField('dating_goal')
  const [birth_date] = defineField('birth_date')
  const [home_city, homeCityAttrs] = defineField('home_city')

  const goalOptions = computed(() => GOAL_OPTIONS)
  const genderOptions = computed(() => GENDER_OPTIONS)

  /**
   * Подтянуть черновик с бэка (что уже есть в профиле).
   */
  async function loadDraft(): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      const { data } = await api.get('/api/onboarding/status')

      if (data?.complete === true) {
        alreadyComplete.value = true
        router.visit('/swipes')
        return
      }

      const draft = data?.draft ?? {}

      setValues({
        name: draft.name ?? '',
        gender: draft.gender ?? null,
        dating_goal: draft.dating_goal ?? null,
        birth_date: draft.birth_date ? new Date(`${draft.birth_date}T00:00:00`) : null,
        home_city: draft.home_city ?? null,
      } as any)
    } catch {
      loadError.value = 'Не получилось загрузить анкету. Обнови страницу.'
    } finally {
      loading.value = false
    }
  }

  const submit = handleSubmit(async (vals: any) => {
    const birthIso = toIsoDate(vals.birth_date)

    if (!birthIso) {
      setErrors({ birth_date: 'Укажи дату рождения' })
      return
    }

    try {
      await api.post('/api/onboarding/complete', {
        name: String(vals.name ?? '').trim(),
        gender: vals.gender,
        birth_date: birthIso,
        dating_goal: vals.dating_goal,
        home_city: String(vals.home_city ?? '').trim() || undefined,
      })

      toast?.add({
        severity: 'success',
        summary: 'Анкета готова 🎉',
        detail: 'Добро пожаловать — показываем свайпы',
        life: 3500,
      })

      router.visit('/swipes')
    } catch (err: any) {
      if (err?.response?.status === 422) {
        const bag = err.response.data?.errors ?? {}
        const flat: Record<string, string> = {}
        for (const key of Object.keys(bag)) {
          const first = Array.isArray(bag[key]) ? bag[key][0] : bag[key]
          if (typeof first === 'string') flat[key] = first
        }
        setErrors(flat)
        if (err.response.data?.message && Object.keys(flat).length === 0) {
          toast?.add({ severity: 'error', summary: 'Не сохранено', detail: err.response.data.message, life: 4000 })
        }
        return
      }
      toast?.add({
        severity: 'error',
        summary: 'Не сохранено',
        detail: err?.response?.data?.message ?? 'Попробуй ещё раз',
        life: 4000,
      })
    }
  })

  onMounted(() => {
    void loadDraft()
  })

  return {
    name,
    nameAttrs,
    gender,
    dating_goal,
    birth_date,
    home_city,
    homeCityAttrs,
    values,
    errors,
    goalOptions,
    genderOptions,
    loading,
    loadError,
    isSubmitting,
    setValues,
    loadDraft,
    submit,
  }
}
