import { computed, ref } from 'vue'
import { referenceApi, type ReferencePage } from '@/services/reference.api'

const SLUG_TITLES: Record<string, string> = {
  contacts: 'Контакты',
  privacy: 'Политика конфиденциальности',
  offer: 'Публичная оферта',
}

/**
 * Хук загрузки публичной справочной страницы.
 * @param slug Слаг страницы (contacts | privacy | offer).
 * @returns Состояние страницы и метод загрузки.
 * @example const { page, load } = usePublicReference('contacts'); await load()
 */
export function usePublicReference(slug: string) {
  const page = ref<ReferencePage | null>(null)
  const loading = ref(false)
  const notFound = ref(false)

  const fallbackTitle = computed(() => SLUG_TITLES[slug] ?? 'Страница')

  async function load() {
    loading.value = true
    notFound.value = false
    try {
      page.value = await referenceApi.show(slug)
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { status?: number } }
      notFound.value = axiosError?.response?.status === 404
      page.value = null
    } finally {
      loading.value = false
    }
  }

  return { page, loading, notFound, fallbackTitle, load }
}
