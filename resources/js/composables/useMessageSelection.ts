import { computed, ref } from 'vue'

/**
 * Мультиселект сообщений в чате (как в Telegram).
 *
 * Старт — ctrl/cmd+клик по сообщению на десктопе или пункт «Выделить»
 * в контекстном меню (лонг-пресс на телефоне). Дальше тап/клик
 * переключает выбор, Esc или крестик — отмена. Состояние живёт
 * пока открыт диалог: смена чата сбрасывает выбор.
 *
 * Компоненты только читают флаги и рисуют чекбоксы — вся механика здесь.
 *
 * @returns выбор сообщений и действия над ним
 * @example
 * ```ts
 * const selection = useMessageSelection()
 * selection.start(42)
 * selection.toggle(43)
 * // selection.ids.value -> [42, 43]
 * ```
 */
export function useMessageSelection() {
  /** Выбранные id сообщений по порядку выбора. */
  const ids = ref<number[]>([])

  const active = computed(() => ids.value.length > 0)
  const count = computed(() => ids.value.length)

  /**
   * Выбрано ли сообщение.
   *
   * @param id id сообщения
   */
  function isSelected(id: number | null | undefined): boolean {
    if (id == null) {
      return false
    }

    return ids.value.includes(Number(id))
  }

  /**
   * Начать выбор с одного сообщения (пункт «Выделить» в меню).
   *
   * @param id id сообщения
   */
  function start(id: number | null | undefined): void {
    if (id == null) {
      return
    }

    const numeric = Number(id)

    ids.value = ids.value.includes(numeric) ? [...ids.value] : [...ids.value, numeric]
  }

  /**
   * Переключить сообщение в выборе (ctrl+клик / тап в режиме выбора).
   *
   * @param id id сообщения
   */
  function toggle(id: number | null | undefined): void {
    if (id == null) {
      return
    }

    const numeric = Number(id)

    if (ids.value.includes(numeric)) {
      ids.value = ids.value.filter((x) => x !== numeric)

      return
    }

    ids.value = [...ids.value, numeric]
  }

  /** Сбросить выбор полностью. */
  function clear(): void {
    ids.value = []
  }

  return { ids, active, count, isSelected, start, toggle, clear }
}
