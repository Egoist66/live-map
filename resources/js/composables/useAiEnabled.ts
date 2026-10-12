import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Глобальный флаг видимости ИИ-функционала.
 *
 * Бэкенд шарит `aiEnabled` через Inertia (дефолт — выключен).
 * Видимость СТРОГО по тумблеру админки: пока выключен, ИИ-виджеты
 * (UPin AI в панели, волшебная кнопка в профиле, диалог гида)
 * не видит никто, включая staff. Включили — видят все.
 *
 * @returns флаг из shared-пропсов и проверки видимости
 * @example
 * const ai = useAiEnabled()
 * if (!ai.canSeeAi.value) return
 */
export function useAiEnabled() {
  const snapshot = computed(() => (usePage().props as unknown as {
    aiEnabled?: boolean | null
    auth?: { user?: { is_admin?: boolean | null; role?: string | null } | null }
  }))

  /** Сырой флаг админки. */
  const isAiEnabled = computed(() => snapshot.value.aiEnabled === true)

  /** Текущий юзер — staff (админ или модератор). */
  const isStaff = computed(() => {
    const user = snapshot.value.auth?.user ?? null
    if (!user) return false
    return !!user.is_admin || user.role === 'admin' || user.role === 'moderator'
  })

  /** Можно ли показывать любую ИИ-фичу: строго тумблер админки, без staff-обхода. */
  const canSeeAi = computed(() => isAiEnabled.value)

  return { isAiEnabled, isStaff, canSeeAi }
}
