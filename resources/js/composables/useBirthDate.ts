import { computed, type Ref } from 'vue'
import { BIRTH_DATE_DISPLAY_FORMAT, BIRTH_DATE_PLACEHOLDER, parseBirthDate } from '@/utils/birthDate'

export function useBirthDateField(field: Ref<any>) {
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
    maxDate: new Date(),
  }))

  return { birthDateInput: input, birthDatePickerProps: pickerProps, birthDatePlaceholder: BIRTH_DATE_PLACEHOLDER }
}
