<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { planOf } from '@/composables/usePlanLimits'
import { usePlanDetails, type PlanId } from '@/composables/usePlanDetails'
import { usePlanSwitch } from '@/composables/usePlanSwitch'
import PlanDetailsDialog from '@/Components/Features/Profile/PlanDetailsDialog.vue'
import { formatDate } from '@/utils/date'
import { useAppModulesStore } from '@/stores/appModules'

defineProps<{ user: any; zoneCount: number }>()

const modules = useAppModulesStore()
const showMapMetrics = computed(() => modules.isEnabled('upin'))

const plans = usePlanSwitch()
const planDialog = usePlanDetails()
const cards = computed(() => plans.planCards(showMapMetrics.value))

/**
 * Подпись плана без упоминаний карты, когда модуль ULove выключен.
 */
function planDesc(plan: string): string {
  if (showMapMetrics.value) {
    if (plan === 'free') return '3 пина/день · 10 км · 4ч'
    if (plan === 'pro') return 'Безлимит · 15 км · 12ч'
    if (plan === 'business') return 'Кабинет · 50+ км · ∞'
    return 'Безлимит · 50+ км · ∞'
  }

  if (plan === 'free') return 'Свайпы · 3 сообщения · мэтчи'
  if (plan === 'pro') return 'Инкогнито · 20 сообщений · хайды'
  if (plan === 'business') return 'Кабинет · максимум · 15 сообщений'
  return 'Максимум · сброс безлимит'
}

/**
 * Выбрать тариф из модалки: переключает сразу через подписки.
 * @param id идентификатор тарифа
 */
async function choosePlan(id: PlanId): Promise<void> {
  planDialog.hide()
  await plans.switchTo(id)
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Тариф и лимиты</h3>
      <p class="text-sm text-stone-500 mt-1">Тариф общий для всего приложения — карта, ULove, лента и приватность. Переключение вступает сразу.</p>
      <div class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">План</div><div class="font-black text-base capitalize dark:text-white">{{ planOf(user) }}</div><div class="text-xs text-stone-500">{{ planDesc(planOf(user)) }}</div><div v-if="planOf(user) !== 'free'" class="text-xs font-semibold" :class="user.plan_expires_at ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">{{ user.plan_expires_at ? `до ${formatDate(user.plan_expires_at)}` : 'бессрочно' }}</div></template></Card>
        <Card v-if="showMapMetrics" class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Пинов сегодня</div><div class="font-black text-base dark:text-white">{{ user.pins_today_count || 0 }}/{{ planOf(user) === 'free' ? 3 : '∞' }}</div><div class="text-xs text-stone-500">лимит — 3 живых · истёкшие освобождают место</div></template></Card>
        <Card v-if="showMapMetrics" class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Подписки</div><div class="font-black text-base dark:text-white">{{ zoneCount }}</div><div class="text-xs text-stone-500">уведомления</div></template></Card>
        <Card v-if="showMapMetrics" class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 !rounded-3xl !shadow-none" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-xs font-medium text-stone-500 uppercase tracking-wide">Радиус</div><div class="font-black text-base dark:text-white">{{ user.home_radius_km || 2 }} км</div><div class="text-xs text-stone-500">{{ user.home_lat ? 'дом задан' : 'не задан' }}</div></template></Card>
      </div>
      <div class="mt-5 text-sm font-bold dark:text-white">Сменить тариф</div>
      <p class="text-xs text-stone-500 mt-1">Нажми на тариф — откроется, что входит. Выбор применяется сразу.</p>
      <div class="mt-3 grid sm:grid-cols-3 gap-2">
        <Card
          v-for="card in cards"
          :key="card.id"
          @click="planDialog.showPlan(card.id)"
          :class="['!rounded-3xl !cursor-pointer !transition active:scale-[0.99]', plans.currentPlan.value === card.id ? ((card.id === 'pro' || card.id === 'premium') ? '!bg-gradient-to-br !from-violet-600 !to-indigo-600 !text-white !border-violet-600' : '!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white') : ((card.id === 'pro' || card.id === 'premium') ? '!bg-amber-50 dark:!bg-amber-950/30 !border-amber-200 dark:!border-amber-800 !text-stone-800 dark:!text-zinc-200' : '!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !text-stone-800 dark:!text-zinc-200')]"
          :pt="{ body: { class: '!p-3' }, content: { class: '!p-0' } }"
        >
          <template #content>
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-black">{{ card.name }}</span>
              <i v-if="plans.currentPlan.value === card.id" class="pi pi-check-circle text-xs" />
            </div>
            <div class="text-xs opacity-70">{{ card.summary }}</div>
            <div class="text-xs font-bold mt-1">{{ card.price }}</div>
            <div class="text-[11px] font-semibold mt-1 underline underline-offset-2">Что входит?</div>
          </template>
        </Card>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Button
          v-if="plans.currentPlan.value !== 'free'"
          label="Отменить подписку"
          icon="pi pi-times"
          severity="secondary"
          rounded
          outlined
          size="small"
          :loading="plans.switching.value === 'free'"
          :disabled="plans.switching.value !== null"
          @click="plans.switchTo('free')"
        />
        <span v-if="plans.switching.value" class="text-xs text-stone-400">Меняем тариф…</span>
      </div>
      <Message v-if="plans.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ plans.error.value }}</Message>
      <PlanDetailsDialog :plan="planDialog.dialogPlan.value" :current-plan="plans.currentPlan.value" @close="planDialog.hide()" @choose="choosePlan" />
    </template>
  </Card>
</template>
