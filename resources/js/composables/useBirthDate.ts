import { computed, type Ref } from 'vue'
import { BIRTH_DATE_DISPLAY_FORMAT, BIRTH_DATE_PLACEHOLDER, parseBirthDate } from '@/utils/birthDate'

/**
 * Обёртка над полем формы с датой рождения: конвертация в Date для
 * PrimeVue DatePicker и общие props пикера.
 *
 * @param field поле формы (строка ISO или null)
 * @param options дополнительные настройки пикера, например ограничение maxDate
 * @returns двустороннее поле + готовые props для DatePicker
 */
export function useBirthDateField(field: Ref<any>, options?: { maxDate?: Date }) {
  const input = computed<Date | null>({
    get: () => parseBirthDate(field.value),
    set: (v) => { field.value = v },
  })

  const pickerProps = computed(() => ({
    dateFormat: BIRTH_DATE_DISPLAY_FORMAT,
    placeholder: BIRTH_DATE_PLACEHOLDER,
    manualInput: true,
    showIcon: true,
    fluid: true,
    maxDate: options?.maxDate ?? new Date(),
  }))

  return { birthDateInput: input, birthDatePickerProps: pickerProps, birthDatePlaceholder: BIRTH_DATE_PLACEHOLDER }
}
