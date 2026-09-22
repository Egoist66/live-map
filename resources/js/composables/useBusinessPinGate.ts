import { computed } from 'vue'
import { useBusinessStore } from '@/stores/business'

/**
 * Гейт создания пинов для бизнес-аккаунта (п.5).
 *
 * Пины — витрина организации: их видят все пользователи карты
 * и все сотрудники в кабинете. Ставить их можно только после
 * проверки по УНП (бэкенд PinController::store отвечает 403).
 *
 * @returns canCreatePin, подсказка и статус проверки
 * @example const gate = useBusinessPinGate()
 */
export function useBusinessPinGate() {
  const store = useBusinessStore()

  const verificationStatus = computed(() => store.profile?.verification_status ?? 'draft')

  const isVerified = computed(() => verificationStatus.value === 'verified')

  const isPending = computed(() => verificationStatus.value === 'pending')

  /**
   * Можно ли жать «Создать пин».
   */
  const canCreatePin = computed(() => isVerified.value)

  /**
   * Текст-подсказка под кнопкой создания.
   */
  const gateHint = computed(() => {
    if (isVerified.value) return null
    if (isPending.value) return 'Пины разблокируются после проверки — заявка уже на модерации'
    if (verificationStatus.value === 'rejected') return 'Проверка отклонена — исправьте реквизиты и отправьте снова, затем сможете ставить пины'
    return 'Сначала пройдите проверку по УНП — после одобрения сможете ставить пины'
  })

  return { store, verificationStatus, isVerified, isPending, canCreatePin, gateHint }
}
