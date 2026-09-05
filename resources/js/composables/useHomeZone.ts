import { computed, type Ref } from 'vue'
import { maxHomeRadiusKm, requiredPlanForRadius, HOME_RADIUS_PRESETS, planRank } from './usePlanLimits'

export function useHomeZone(planRef: Ref<string | null | undefined> | string, radiusRef: Ref<number | null | undefined> | number | null, setRadius?: (v: number) => void) {
  const getPlan = () => (typeof planRef === 'object' ? (planRef as Ref).value || 'free' : (planRef as string) || 'free')
  const getRadius = () => (typeof radiusRef === 'object' ? Number((radiusRef as Ref).value ?? 0) : Number(radiusRef ?? 0))
  const plan = computed(getPlan)
  const radius = computed(getRadius)
  const max = computed(() => maxHomeRadiusKm(plan.value))
  const needPlan = computed(() => requiredPlanForRadius(radius.value || 1))
  const hint = computed(() => {
    const r = radius.value || 1
    return `Вижу чужие и мои пины в радиусе ${r} км от дома — тот же радиус, что у пина (${plan.value === 'free' ? 'Free 5 км' : plan.value === 'pro' ? 'Pro 15 км' : 'Business 50+ км'}). Настройка по умолчанию, чтобы не задавать каждый пин.`
  })
  const presets = computed(() =>
    HOME_RADIUS_PRESETS.map((p) => ({
      ...p,
      active: radius.value === p.v,
      locked: planRank(plan.value) < planRank(p.minPlan),
      label: `${p.v} км`,
    })),
  )
  function select(v: number) {
    const m = maxHomeRadiusKm(plan.value)
    const safe = Math.min(v, m)
    if (setRadius) setRadius(safe)
    return safe
  }
  function clamp() {
    const m = maxHomeRadiusKm(plan.value)
    if (radius.value > m && setRadius) setRadius(m)
  }
  return { plan, radius, max, needPlan, hint, presets, select, clamp }
}
