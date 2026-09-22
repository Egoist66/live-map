import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { storeToRefs } from 'pinia'
import { usePeopleSearchStore } from '@/stores/peopleSearch'
import type { BusinessMapItem } from '@/types/entities/Business'

/**
 * Поиск организаций внутри глобального поиска (таб «Организации»).
 *
 * Тонкий хук над `usePeopleSearchStore`: держит запрос/выдачу,
 * считает витринное название (бренд важнее юрназвания) и ведёт
 * на публичный профиль компании `/users/{owner_profile}`.
 *
 * @example
 * const orgs = useOrganizationSearch()
 * orgs.setQuery('кофейня')
 */
export function useOrganizationSearch() {
  const store = usePeopleSearchStore()
  const { orgQuery, orgResults, orgSearching } = storeToRefs(store)

  const hasQuery = computed(() => orgQuery.value.trim().length >= 2)

  /**
   * Витринное название компании: бренд, иначе юрназвание.
   * @param row карточка организации из выдачи
   * @returns бренд или name
   */
  function displayName(row: BusinessMapItem): string {
    const brand = String(row?.brand ?? '').trim()
    if (brand !== '') {
      return brand
    }
    return String(row?.name ?? '').trim() || 'Организация'
  }

  /**
   * Подпись под названием: юрназвание (когда показан бренд) + категория.
   * @param row карточка организации из выдачи
   * @returns подпись или пусто
   */
  function displayCaption(row: BusinessMapItem): string {
    const brand = String(row?.brand ?? '').trim()
    const name = String(row?.name ?? '').trim()
    const category = String(row?.category ?? '').trim()
    const parts: string[] = []
    if (brand !== '' && name !== '' && name !== brand) {
      parts.push(name)
    }
    if (category !== '') {
      parts.push(category)
    }
    return parts.join(' · ')
  }

  /**
   * Открыть публичный профиль компании и закрыть поиск.
   * @param row карточка организации из выдачи
   */
  function openCompany(row: BusinessMapItem): void {
    const profile = String(row?.owner_profile ?? '').trim()
    store.closeDialog()
    if (profile !== '') {
      router.visit(`/users/${profile}`)
    }
  }

  return {
    orgQuery,
    orgResults,
    orgSearching,
    hasQuery,
    setQuery: store.setOrgQuery,
    displayName,
    displayCaption,
    openCompany,
  }
}
