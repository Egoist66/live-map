import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Глобальный флаг видимости ИИ-функционала.
 *
 * Бэкенд шарит `aiEnabled` через Inertia (дефолт — выключен).
 * Staff (админ/модератор) видит ИИ всегда, чтобы тестировать
 * без палева для обычных пользователей.
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

  /** Сырой флаг админки (без staff-обхода). */
  const isAiEnabled = computed(() => snapshot.value.aiEnabled === true)

  /** Текущий юзер — staff (админ или модератор). */
  const isStaff = computed(() => {
    const user = snapshot.value.auth?.user ?? null
    if (!user) return false
    return !!user.is_admin || user.role === 'admin' || user.role === 'moderator'
  })

  /** Можно ли показывать любую ИИ-фичу этому зрителю. */
  const canSeeAi = computed(() => isAiEnabled.value || isStaff.value)

  return { isAiEnabled, isStaff, canSeeAi }
}
