import { computed, ref } from 'vue'
import { useAppModulesStore } from '@/stores/appModules'

const STORAGE_KEY = 'upin.chat.peer-panel'

/**
 * Читать сохранённое состояние панели (SSR-safe: на сервере — открыто).
 *
 * @returns true если панель не сворачивали
 */
function readStored(): boolean {
  try {
    if (typeof window === 'undefined') {
      return true
    }

    return window.localStorage.getItem(STORAGE_KEY) !== 'closed'
  } catch {
    return true
  }
}

const open = ref(readStored())

/**
 * Правая Tinder-панель собеседника в чате.
 *
 * Панель существует только при включённом модуле ULove: фото профиля,
 * бейдж мэтча/цели, интересы, кнопки «Открыть профиль» и «Заблокировать».
 * Без ulove её нет вообще — ни панели, ни кнопки-тоггла.
 * Состояние свернута/развернута переживает перезагрузку (localStorage),
 * чтобы чат мог занимать всю ширину.
 *
 * @returns enabled (ulove включён), open, toggle, setOpen
 * @example
 * ```ts
 * const peerPanel = useChatPeerPanel()
 * const show = computed(() => peerPanel.enabled.value && peerPanel.open.value && !!peer.value)
 * ```
 */
export function useChatPeerPanel() {
  const modules = useAppModulesStore()

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
   * Переключить панель (состояние запоминается).
   */
  function toggle(): void {
    setOpen(!open.value)
  }

  /**
   * Явно открыть/закрыть панель (состояние запоминается).
   *
   * @param value true — развернуть, false — свернуть
   */
  function setOpen(value: boolean): void {
    open.value = value

    try {
      window.localStorage.setItem(STORAGE_KEY, value ? 'open' : 'closed')
    } catch {
    }
  }

  return { enabled, open: computed(() => open.value), toggle, setOpen }
}
