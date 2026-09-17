import { ref, computed, watch } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useToast } from 'primevue/usetoast'
import { maxHomeRadiusKm, planOf } from './usePlanLimits'

/**
 * Настройка радиуса домашней зоны из раздела «Приватность».
 * Сохраняет home_radius_km через profile.update.
 * @example const r = useHomeRadiusSetting(); r.save(10)
 */
export function useHomeRadiusSetting() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')
  const plan = computed(() => planOf(authUser.value))
  const maxRadius = computed(() => maxHomeRadiusKm(plan.value, isAdmin.value))

  const radius = ref<number>(Number(authUser.value?.home_radius_km ?? 10))
  const saving = ref(false)
  const error = ref<string | null>(null)

  watch(authUser, (u) => {
    if (!u || saving.value) return
    radius.value = Number(u.home_radius_km ?? 10)
  })

  /**
   * @param v новый радиус в км
   */
  function save(v: number): void {
    const next = Math.round(Number(v) || 10)
    error.value = null
    if (!isAdmin.value && next > maxRadius.value) {
      error.value = `Максимум ${maxRadius.value} км на тарифе ${String(plan.value).toUpperCase()}. Для ${next} км нужен Pro/Business.`
      toast?.add({ severity: 'warn', summary: 'Нужен Pro', detail: error.value, life: 4000 })
      return
    }
    const u = authUser.value
    if (!u) return
    radius.value = next
    saving.value = true
    router.patch(
      route('profile.update'),
      { name: u.name, email: u.email, home_radius_km: next } as any,
      {
        preserveScroll: true,
        onSuccess: () => toast?.add({ severity: 'success', summary: 'Зона сохранена', detail: `Вижу пины в радиусе ${next} км`, life: 2000 }),
        onError: (e: any) => {
          error.value = Object.values(e || {}).flat().join(', ') || 'Не удалось сохранить'
          toast?.add({ severity: 'error', summary: 'Ошибка', detail: error.value as string, life: 3000 })
        },
        onFinish: () => { saving.value = false },
      },
    )
  }

  return { radius, maxRadius, plan, isAdmin, saving, error, save }
}
