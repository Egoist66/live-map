import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { PIN_CATEGORIES } from './usePins'
import { customCategoriesApi } from '@/services/custom-categories.api'
import { planOf } from './usePlanLimits'

export interface CustomCategoryDef {
  id: number
  slug: string
  label: string
  icon: string
  color: string
  is_owner: boolean
}

export const CUSTOM_ICONS = ['🎣', '⚽', '🎮', '📷', '💃', '🍷', '🚗', '🌙', '☀️', '⭐', '🔥', '🌲'] as const
export const CUSTOM_COLORS = ['#16A34A', '#F59E0B', '#8B5CF6', '#0D9488', '#0284C7', '#E11D48', '#4F46E5', '#A16207'] as const

const defs = ref<CustomCategoryDef[]>([])
const loading = ref(false)
let loaded = false

export function useCustomCategories() {
  const page = usePage() as any
  const user = computed(() => page.props.auth?.user)
  const canCreate = computed(() => {
    const u = user.value
    return !!u?.is_admin || u?.role === 'admin' || planOf(u) === 'pro' || planOf(u) === 'business'
  })

  const allCategories = computed(() => [
    ...(PIN_CATEGORIES as unknown as any[]),
    ...defs.value.map((d) => ({ v: d.slug, l: d.label, i: d.icon, c: d.color, custom: true, mine: d.is_owner })),
  ])

  function metaOf(v: string | null | undefined): { v: string; l: string; i: string; c: string } {
    const found = (allCategories.value as any[]).find((c) => c.v === v)
    if (found) return found
    return { v: String(v ?? ''), l: String(v ?? ''), i: '📍', c: '#DC2626' }
  }

  async function fetchAll(force = false): Promise<CustomCategoryDef[]> {
    if (loaded && !force) return defs.value
    loading.value = true
    try {
      defs.value = await customCategoriesApi.list()
      loaded = true
    } catch {
      defs.value = []
    } finally {
      loading.value = false
    }
    return defs.value
  }

  const draftOpen = ref(false)
  const draftLabel = ref('')
  const draftIcon = ref<string>(CUSTOM_ICONS[0])
  const draftColor = ref<string>(CUSTOM_COLORS[0])
  const draftError = ref('')
  const draftSaving = ref(false)

  async function createFromDraft(): Promise<CustomCategoryDef | null> {
    draftError.value = ''
    const label = draftLabel.value.trim()
    if (label.length < 2) {
      draftError.value = 'Название от 2 символов'
      return null
    }
    draftSaving.value = true
    try {
      const d = await customCategoriesApi.create({ label, icon: draftIcon.value, color: draftColor.value })
      defs.value = [...defs.value.filter((x) => x.slug !== d.slug), d]
      draftLabel.value = ''
      draftOpen.value = false
      return d
    } catch (e: any) {
      draftError.value = e?.response?.data?.message || 'Не удалось создать категорию'
      return null
    } finally {
      draftSaving.value = false
    }
  }

  async function remove(slug: string): Promise<void> {
    await customCategoriesApi.remove(slug)
    defs.value = defs.value.filter((d) => d.slug !== slug)
  }

  return {
    defs, loading, canCreate, allCategories, metaOf, fetchAll,
    draftOpen, draftLabel, draftIcon, draftColor, draftError, draftSaving,
    icons: CUSTOM_ICONS, colors: CUSTOM_COLORS,
    createFromDraft, remove,
  }
}
