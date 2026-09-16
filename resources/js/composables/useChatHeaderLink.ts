import { computed } from 'vue'
import type { Ref } from 'vue'

/**
 * Ссылка шапки чата: район ведёт на карту, личка — в профиль.
 *
 * Чат района (`type === 'district'`) раньше вёл на случайного
 * участника (`other.id` → `/users/...`). Теперь ведёт на
 * `/map?district=ID` — карта сама откроет модалку/группу района.
 *
 * @param activeConv активный чат из `useChat`
 * @returns флаг района, id района и готовый href для шапки
 * @example
 * const headerLink = useChatHeaderLink(computed(() => props.activeConv))
 * <Link :href="headerLink.href.value" />
 */
export function useChatHeaderLink(activeConv: Ref<any>) {
  const conversationType = computed(() => String(activeConv.value?.type ?? 'direct'))

  const isDistrictChat = computed(() => conversationType.value === 'district')

  const districtId = computed(() => {
    const rawId = Number(activeConv.value?.district_id ?? 0)

    const isValid = Number.isFinite(rawId) && rawId > 0

    return isValid ? rawId : 0
  })

  const peerId = computed(() => {
    const rawId = Number(activeConv.value?.other?.id ?? 0)

    const isValid = Number.isFinite(rawId) && rawId > 0

    return isValid ? rawId : 0
  })

  const headerHref = computed(() => {
    const isDistrictTarget = isDistrictChat.value && districtId.value > 0

    if (isDistrictTarget) {
      return `/map?district=${districtId.value}`
    }

    const isUserTarget = peerId.value > 0

    if (isUserTarget) {
      return `/users/${peerId.value}`
    }

    return '#'
  })

  return { isDistrictChat, districtId, headerHref }
}
