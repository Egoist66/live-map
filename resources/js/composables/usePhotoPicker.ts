import { ref } from 'vue'

/**
 * Системный выбор фото через скрытый file-инпут.
 *
 * Инпут нельзя прятать через display:none — мобильный Safari игнорирует
 * программный клик по нему. Держим инпут в DOM 1px/прозрачным.
 *
 * @param opts.onPick колбэк с выбранным файлом
 * @returns ref инпута, открытие пикера и обработчик change
 *
 * @example
 * const { pickerInput, openPicker, handlePickerChange } = usePhotoPicker({
 *   onPick: (file) => emit('addPhoto', file),
 * })
 */
export function usePhotoPicker(opts: { onPick: (file: File) => void }) {
  const pickerInput = ref<HTMLInputElement | null>(null)

  /**
   * Открывает системный выбор фото с устройства.
   *
   * @returns void
   */
  function openPicker(): void {
    pickerInput.value?.click()
  }

  /**
   * Забирает первый файл из инпута и сбрасывает его для повторного выбора.
   *
   * @param event событие change инпута
   * @returns void
   */
  function handlePickerChange(event: Event): void {
    const target = event.target as HTMLInputElement | null
    const file = target?.files?.[0]
    if (target) {
      target.value = ''
    }
    if (!file) {
      return
    }
    opts.onPick(file)
  }

  return { pickerInput, openPicker, handlePickerChange }
}
