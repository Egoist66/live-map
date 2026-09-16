import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useDistrictsStore } from '@/stores/districts'
import { DISTRICT_INTEREST_OPTIONS, countGeometryPoints } from '@/utils/districtGeo'
import { clearDistrictDraft, loadDistrictDraft } from '@/composables/useDistrictDraft'

/**
 * Страница создания района: форма + черновик заливки с карты.
 *
 * Черновик лежит в sessionStorage (useDistrictDraft): страница только
 * валидирует форму и создаёт район через pinia-стор.
 *
 * @param canCreate разрешено ли создание тарифом (SSR)
 * @param limitText строка лимита тарифа (SSR)
 * @example
 * const create = useDistrictCreatePage(props.canCreate, props.limitText)
 * await create.submit()
 */
export function useDistrictCreatePage(canCreate: boolean, limitText: string) {
  const store = useDistrictsStore()

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  /** Название сообщества. */
  const name = ref('')
  /** Описание сообщества. */
  const description = ref('')
  /** Ключ интереса. */
  const interest = ref<string>('neighbors')
  /** Черновик заливки с карты. */
  const hasDraft = ref(false)
  const strokesCount = ref(0)
  const pointsCount = ref(0)
  const formError = ref<string | null>(null)
  const serverError = ref<string | null>(null)
  const creating = computed(() => store.saving)

  const interestLabel = computed(() => {
    const found = DISTRICT_INTEREST_OPTIONS.find((option) => option.v === interest.value)
    return found ? `${found.i} ${found.l}` : 'Направление'
  })
  const avatarLetter = computed(() => {
    const clean = name.value.trim()
    return clean ? clean.slice(0, 1).toUpperCase() : '?'
  })
  const nameLength = computed(() => name.value.trim().length)
  const isNameValid = computed(() => nameLength.value >= 3)
  const canSubmit = computed(() => isNameValid.value && hasDraft.value && canCreate && !store.saving)

  /**
   * Подтянуть черновик заливки из sessionStorage.
   */
  function reloadDraft(): void {
    const draft = loadDistrictDraft()
    if (!draft) {
      hasDraft.value = false
      strokesCount.value = 0
      pointsCount.value = 0
      return
    }
    hasDraft.value = true
    strokesCount.value = draft.strokesCount
    pointsCount.value = countGeometryPoints(draft.geometry)
  }

  onMounted(() => {
    reloadDraft()
  })

  /**
   * Выбрать интерес сообщества.
   *
   * @param value ключ интереса
   */
  function setInterest(value: string): void {
    interest.value = value
  }

  /**
   * Вернуться на карту дорисовать заливку.
   */
  function backToMap(): void {
    router.visit('/map')
  }

  /**
   * Открыть список районов.
   */
  function openList(): void {
    router.visit('/districts')
  }

  /**
   * Создать район из черновика.
   */
  async function submit(): Promise<void> {
    const clean = name.value.trim()
    if (clean.length < 3) {
      formError.value = 'Название — минимум 3 символа'
      return
    }
    const draft = loadDistrictDraft()
    if (!draft) {
      formError.value = 'Нет заливки: нарисуйте район на карте кистью'
      hasDraft.value = false
      return
    }
    formError.value = null
    serverError.value = null
    try {
      const created = await store.createDistrict({
        name: clean,
        description: description.value.trim() || null,
        interest: interest.value,
        geometry: draft.geometry,
      })
      clearDistrictDraft()
      toast?.add({ severity: 'success', summary: 'Сообщество создано', detail: 'Заливка видна всем, пины внутри — только жителям', life: 3500 })
      router.visit(`/districts/${created.id}`)
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не удалось создать район'
      serverError.value = message
      toast?.add({ severity: 'error', summary: 'Не сохранено', detail: message, life: 5000 })
    }
  }

  return {
    name,
    description,
    interest,
    hasDraft,
    strokesCount,
    pointsCount,
    formError,
    serverError,
    creating,
    canCreate,
    limitText,
    interestLabel,
    avatarLetter,
    nameLength,
    isNameValid,
    canSubmit,
    reloadDraft,
    setInterest,
    backToMap,
    openList,
    submit,
  }
}
