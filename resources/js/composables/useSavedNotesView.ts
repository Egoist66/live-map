import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Режим «Избранное как чат» — вместо модалки открывает SavedNotesChat
 * в центральной колонке чатов, как обычный диалог (Правило №1).
 *
 * Хранит только флаг и действия; синхронизацию с `selectedId`
 * обычного чата делает страница `Chat/Index` (взаимное исключение).
 *
 * @example
 * const savedView = useSavedNotesView()
 * savedView.open()
 *
 * @returns флаг и действия просмотра избранного
 */
export function useSavedNotesView() {
  const isSavedOpen = ref(false)

  /**
   * Открыть избранное как чат.
   */
  function open(): void {
    isSavedOpen.value = true
  }

  /**
   * Закрыть избранное (вернуться к списку).
   */
  function close(): void {
    isSavedOpen.value = false
  }

  /**
   * Переключить видимость избранного.
   */
  function toggle(): void {
    isSavedOpen.value = !isSavedOpen.value
  }

  /**
   * Закрывать по Esc, как обычный диалог.
   *
   * @param event событие клавиатуры
   */
  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return
    }

    if (isSavedOpen.value) {
      close()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
  })

  return {
    isSavedOpen,
    open,
    close,
    toggle,
  }
}
