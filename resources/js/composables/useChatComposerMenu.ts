import { ref } from 'vue'

/**
 * Состояние меню вложений композера чата.
 *
 * Кнопки файла, смайлов и геопозиции прячутся
 * за иконку «три точки».
 *
 * @returns флаг открытия и действия меню
 *
 * @example
 * const composerMenu = useChatComposerMenu()
 * composerMenu.toggle()
 */
export function useChatComposerMenu() {
  const open = ref(false)

  function toggle(): void {
    open.value = !open.value
  }

  function close(): void {
    open.value = false
  }

  return { open, toggle, close }
}
