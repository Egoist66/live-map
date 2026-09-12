import { ref } from 'vue'

/**
 * Небольшая модалка с полным текстом плитки «Общей информации».
 *
 * На мобилке значения обрезаются — по клику показываем их целиком.
 *
 * @returns состояние модалки и действия
 * @example
 * const modal = useInfoTileModal()
 * modal.show('Город', 'Москва, Россия')
 */
export function useInfoTileModal() {
  const open = ref(false)
  const title = ref('')
  const text = ref('')

  /**
   * Открывает модалку с полным текстом.
   * @param nextTitle заголовок (название поля)
   * @param nextText полный текст значения
   */
  function show(nextTitle: string, nextText: string): void {
    title.value = nextTitle
    text.value = nextText
    open.value = true
  }

  /** Закрывает модалку. */
  function close(): void {
    open.value = false
  }

  return { open, title, text, show, close }
}
