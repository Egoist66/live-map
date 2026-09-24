import { computed, ref } from 'vue'
import { useAppModulesStore } from '@/stores/appModules'
import { useUloveOnly } from '@/composables/useUloveOnly'

const STORAGE_KEY = 'upin.chat.peer-panel'

/**
 * Явный выбор пользователя: 'open' | 'closed'. Null — выбора не было,
 * панель открывается/скрывается по режиму (см. uloveOnly ниже).
 */
type PeerPanelPref = 'open' | 'closed' | null

/**
 * Читать сохранённый выбор панели (SSR-safe: на сервере — null).
 *
 * Отсутствие ключа означает «пользователь не трогал» — тогда default
 * берётся из режима, а не из старого «открыто всегда».
 *
 * @returns выбор пользователя или null
 */
function readStoredPref(): PeerPanelPref {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (raw === 'open' || raw === 'closed') {
      return raw
    }

    return null
  } catch {
    return null
  }
}

const explicit = ref<PeerPanelPref>(readStoredPref())

/**
 * Правая панель собеседника в чате.
 *
 * Панель существует при включённом модуле ULove. По умолчанию она
 * открыта только в чистом ULove-режиме (только модуль ulove, без карты
 * и ленты): там чат — продолжение свайпов и анкета рядом кстати.
 * Как только включены другие разделы — по умолчанию скрыта, чтобы не
 * съедать ширину чата; открывается тогглом в шапке.
 * Явный выбор (открыл/закрыл сам) запоминается и переживает смену
 * режимов и перезагрузку.
 *
 * @returns enabled (ulove включён), uloveOnly (чистый ULove), open, toggle, setOpen
 * @example
 * ```ts
 * const peerPanel = useChatPeerPanel()
 * const show = computed(() => peerPanel.enabled.value && peerPanel.open.value && !!peer.value)
 * ```
 */
export function useChatPeerPanel() {
  const modules = useAppModulesStore()
  const uloveOnly = useUloveOnly()

  /**
   * Доступен ли раздел ULove (панель имеет смысл только с ним).
   */
  const enabled = computed(() => {
    try {
      return modules.isEnabled('ulove')
    } catch {
      return false
    }
  })

  /**
   * Открыта ли панель: явный выбор пользователя, иначе default по режиму
   * (открыто — только в чистом ULove, с другими разделами — скрыто).
   */
  const open = computed(() => {
    if (explicit.value !== null) {
      return explicit.value === 'open'
    }

    return uloveOnly.value
  })

  /**
   * Переключить панель (выбор запоминается).
   */
  function toggle(): void {
    setOpen(!open.value)
  }

  /**
   * Явно открыть/закрыть панель (выбор запоминается).
   *
   * @param value true — развернуть, false — свернуть
   */
  function setOpen(value: boolean): void {
    explicit.value = value ? 'open' : 'closed'

    try {
      window.localStorage.setItem(STORAGE_KEY, value ? 'open' : 'closed')
    } catch {
    }
  }

  return { enabled, uloveOnly, open, toggle, setOpen }
}
