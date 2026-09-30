import { computed, type Ref } from 'vue'

/**
 * Тариф пользователя.
 *
 * free — бесплатный, pro — платный, premium — топ для стаффа
 * (админ/модератор получают его по умолчанию), business — только
 * для организаторов (кабинет компании, те же топ-лимиты).
 */
export type Plan = 'free' | 'pro' | 'premium' | 'business'

/** Топ-тарифы с максимальными лимитами. */
export const TOP_PLANS: ReadonlyArray<Plan> = ['premium', 'business']

/** Платные тарифы. */
export const PAID_PLANS: ReadonlyArray<Plan> = ['pro', 'premium', 'business']

export function planOf(u: any): string {
  return u?.effective_plan ?? u?.plan ?? 'free'
}

export const HOME_RADIUS_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 15,
  premium: 50,
  business: 50,
}

export const PIN_RADIUS_M_LIMITS: Record<Plan, number> = {
  free: 10000,
  pro: 15000,
  premium: 50000,
  business: 50000,
}

export const HOME_RADIUS_PRESETS: Array<{ v: number; minPlan: Plan }> = [
  { v: 1, minPlan: 'free' },
  { v: 2, minPlan: 'free' },
  { v: 5, minPlan: 'free' },
  { v: 10, minPlan: 'free' },
  { v: 15, minPlan: 'pro' },
  { v: 20, minPlan: 'premium' },
  { v: 50, minPlan: 'premium' },
]

export function maxHomeRadiusKm(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 500
  if (plan === 'business' || plan === 'premium') return 50
  if (plan === 'pro') return 15
  return 10
}

export function maxPinRadiusM(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 500000
  if (plan === 'business' || plan === 'premium') return 50000
  if (plan === 'pro') return 15000
  return 10000
}

export function planRank(plan?: string | null): number {
  if (plan === 'business' || plan === 'premium') return 2
  if (plan === 'pro') return 1
  return 0
}

export function canUseHomeRadius(radiusKm: number, plan?: string | null, isAdmin?: boolean): boolean {
  if (!radiusKm || radiusKm < 1) return false
  return radiusKm <= maxHomeRadiusKm(plan, isAdmin)
}

export function requiredPlanForRadius(radiusKm: number): Plan {
  if (radiusKm > 15) return 'premium'
  if (radiusKm > 10) return 'pro'
  return 'free'
}

export function formatRadiusKm(v: number): string {
  return `${v} км`
}

export function usePlanLimits(planRef: Ref<string | undefined | null> | string | null | undefined, isAdminRef?: Ref<boolean> | boolean) {
  const plan = computed(() => (typeof planRef === 'string' || planRef == null ? (planRef as any) : (planRef as Ref).value) || 'free')
  const isAdmin = computed(() => (typeof isAdminRef === 'boolean' || isAdminRef == null ? (isAdminRef as any) : (isAdminRef as Ref).value) || false)
  const maxHomeRadius = computed(() => maxHomeRadiusKm(plan.value, isAdmin.value))
  const maxPinRadius = computed(() => maxPinRadiusM(plan.value, isAdmin.value))
  const presets = computed(() =>
    HOME_RADIUS_PRESETS.map((p) => ({
      ...p,
      locked: planRank(plan.value) < planRank(p.minPlan) && !isAdmin.value,
      label: `${p.v} км`,
    })),
  )
  return { plan, isAdmin, maxHomeRadius, maxPinRadius, presets, canUseHomeRadius: (v: number) => canUseHomeRadius(v, plan.value, isAdmin.value), requiredPlanForRadius }
}
