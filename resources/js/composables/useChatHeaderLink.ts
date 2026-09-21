import { computed } from 'vue'
import type { Ref } from 'vue'
import { useProfileUrl } from '@/composables/useProfileUrl'

/**
 * Ссылка шапки чата: район ведёт на страницу района, личка — в профиль.
 *
 * Чат района (`type === 'district'`) ведёт сразу на
 * `/districts/ID` — без промежуточного захода на карту.
 *
 * @param activeConv активный чат из `useChat`
 * @returns флаг района, id района и готовый href для шапки
 * @example
 * const headerLink = useChatHeaderLink(computed(() => props.activeConv))
 * <Link :href="headerLink.href.value" />
 */
export function useChatHeaderLink(activeConv: Ref<any>) {
  const { userProfileUrl } = useProfileUrl()

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

  const peer = computed(() => activeConv.value?.other ?? null)

  const headerHref = computed(() => {
    const isDistrictTarget = isDistrictChat.value && districtId.value > 0

    if (isDistrictTarget) {
      return `/districts/${districtId.value}`
    }

    const isUserTarget = peerId.value > 0

    if (isUserTarget) {
      return userProfileUrl(peer.value)
    }

    return '#'
  })

  return { isDistrictChat, districtId, headerHref }
}
