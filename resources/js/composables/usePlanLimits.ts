import { computed, type Ref } from 'vue'

export type Plan = 'free' | 'pro' | 'business'

export const HOME_RADIUS_LIMITS: Record<Plan, number> = {
  free: 1,
  pro: 5,
  business: 50,
}

export const PIN_RADIUS_M_LIMITS: Record<Plan, number> = {
  free: 1000,
  pro: 5000,
  business: 50000,
}

export const HOME_RADIUS_PRESETS: Array<{ v: number; minPlan: Plan }> = [
  { v: 1, minPlan: 'free' },
  { v: 2, minPlan: 'pro' },
  { v: 5, minPlan: 'pro' },
  { v: 10, minPlan: 'business' },
  { v: 50, minPlan: 'business' },
]

export function maxHomeRadiusKm(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 50
  if (plan === 'business') return 50
  if (plan === 'pro') return 5
  return 1
}

export function maxPinRadiusM(plan?: string | null, isAdmin?: boolean): number {
  if (isAdmin) return 50000
  if (plan === 'business') return 50000
  if (plan === 'pro') return 5000
  return 1000
}

export function planRank(plan?: string | null): number {
  if (plan === 'business') return 2
  if (plan === 'pro') return 1
  return 0
}

export function canUseHomeRadius(radiusKm: number, plan?: string | null, isAdmin?: boolean): boolean {
  if (!radiusKm || radiusKm < 1) return false
  return radiusKm <= maxHomeRadiusKm(plan, isAdmin)
}

export function requiredPlanForRadius(radiusKm: number): Plan {
  if (radiusKm > 5) return 'business'
  if (radiusKm > 1) return 'pro'
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
