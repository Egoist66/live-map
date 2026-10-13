<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import type { PlanDetails, PlanId } from '@/composables/usePlanDetails'

defineProps<{ plan: PlanDetails | null; currentPlan: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'choose', id: PlanId): void }>()
</script>

<!--
  Модалка «Что даёт тариф»: полное объяснение плана.
  Логика — в usePlanDetails, компонент только отображает.
-->
<template>
  <Dialog
    :visible="plan !== null"
    @update:visible="(visible:boolean)=>{ if (!visible) emit('close') }"
    modal
    dismissableMask
    :draggable="false"
    :style="{ width: '560px', maxWidth: '94vw' }"
    :pt="{
      root: { class: 'plan-dialog !rounded-[28px] max-sm:!rounded-b-none !border-0 overflow-hidden !bg-white dark:!bg-zinc-900' },
      header: { class: '!p-0 !m-0 !border-0' },
      headerActions: { class: '!hidden' },
      closeButton: { class: '!hidden' },
      content: { class: '!px-4 !py-4 sm:!px-6 !overflow-y-auto !overscroll-contain max-h-[62dvh]' },
      footer: { class: '!px-4 !py-4 sm:!px-6 !border-0 !bg-stone-50 dark:!bg-zinc-800/60' },
    }"
  >
    <template #header>
      <div v-if="plan" :class="['flex items-start w-full text-white bg-gradient-to-br', plan.gradient]">
        <div class="flex-1 min-w-0 px-4 pt-5 pb-6 sm:px-6">
          <div class="text-xs font-bold uppercase tracking-widest opacity-80">Тариф</div>
          <div class="mt-1 text-2xl font-black tracking-tight">{{ plan.name }}</div>
          <div class="mt-1 text-sm font-semibold">{{ plan.price }}</div>
          <p class="mt-1 text-sm text-white/80 leading-relaxed">{{ plan.tagline }}</p>
        </div>
        <Button icon="pi pi-times" text rounded aria-label="Закрыть" class="!m-3 !w-9 !h-9 !shrink-0 !text-white hover:!bg-white/20 !border-0" @click="emit('close')" />
      </div>
    </template>
    <div v-if="plan" class="space-y-4">
      <div v-for="group in plan.groups" :key="group.title">
        <div class="text-sm font-black text-stone-900 dark:text-white">{{ group.title }}</div>
        <ul class="mt-2 space-y-1.5">
          <li v-for="item in group.items" :key="item.text" class="flex items-start gap-2 text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">
            <i class="pi pi-check text-emerald-500 text-xs mt-1 shrink-0" />
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <div v-if="plan" class="flex flex-col sm:flex-row sm:items-center gap-2">
        <div class="text-xs text-stone-500 dark:text-zinc-400 flex-1">Тариф общий для всего приложения — вступит сразу после выбора</div>
        <Button
          :label="currentPlan === plan.id ? 'Это твой тариф ✓' : `Выбрать ${plan.name}`"
          :disabled="currentPlan === plan.id"
          rounded
          class="w-full sm:w-auto"
          :class="currentPlan === plan.id ? '' : '!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900'"
          @click="emit('choose', plan.id)"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.plan-dialog :deep(.p-dialog-header-actions) {
  display: none !important;
}
</style>
