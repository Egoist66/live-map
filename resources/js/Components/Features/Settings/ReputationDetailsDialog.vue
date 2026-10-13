<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import DatingRatingStars from '@/Components/Features/Dating/DatingRatingStars.vue'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'
import type { useReputationDetails } from '@/composables/useReputationDetails'

const props = defineProps<{ details: ReturnType<typeof useReputationDetails> }>()

const { isMobile } = useViewportBreakpoints()

/**
 * Закрытие шторки свайпом вниз: PrimeVue сам эмитит update:visible.
 */
function onVisibleChange(visible: boolean): void {
  if (!visible) {
    props.details.close()
  }
}
</script>

<template>
  <Dialog
    :visible="details.isOpen.value"
    @update:visible="onVisibleChange"
    modal
    :draggable="false"
    :block-scroll="true"
    :position="isMobile ? 'bottom' : 'center'"
    :breakpoints="{ '640px': '100vw' }"
    header="Сведения о репутации"
    :style="{ width: '440px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{ root: { class: 'reputation-sheet !rounded-3xl max-sm:!rounded-b-none !overflow-hidden dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: 'dark:!bg-zinc-900 dark:!text-white' }, content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto overscroll-contain' } }"
  >
    <section aria-label="Сведения о репутации" class="pt-1">
      <div v-if="details.trust.loading.value" class="flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
        <i class="pi pi-spin pi-spinner" aria-label="Загрузка репутации" /> Грузим репутацию…
      </div>
      <div v-else-if="details.score.value != null" class="flex items-center gap-3">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl font-black text-white shadow">{{ details.score.value }}</span>
        <div class="min-w-0">
          <div class="text-sm font-black text-stone-900 dark:text-white">{{ details.score.value }} из 10 · {{ details.trust.label.value }}</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">{{ details.trust.hint.value }}</div>
        </div>
      </div>

      <div v-if="details.rating.hasRatings.value" class="mt-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 px-3 py-2.5">
        <DatingRatingStars :avg="details.rating.average.value" :count="details.rating.count.value" tone="light" />
        <p class="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">Ваши звёзды — средний балл отзывов<span v-if="details.rating.isHidden.value"> · скрыты от других (PRO)</span></p>
      </div>

      <h4 class="mt-4 text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Шкала доверия</h4>
      <ul class="mt-2 space-y-1.5">
        <li
          v-for="zone in details.zones"
          :key="zone.label"
          class="flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-sm"
          :class="details.currentZone.value?.label === zone.label
            ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
            : 'border-stone-200 dark:border-zinc-700'"
        >
          <span class="shrink-0 rounded-full bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-black text-stone-600 dark:text-zinc-200">{{ zone.min }}–{{ zone.max }}</span>
          <span class="min-w-0 flex-1 font-semibold text-stone-700 dark:text-zinc-200">{{ zone.label }}</span>
          <Tag v-if="details.currentZone.value?.label === zone.label" value="вы здесь" class="!text-[10px] !font-bold !bg-amber-400 !text-white !border-0 shrink-0" />
        </li>
      </ul>

      <h4 class="mt-4 text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Что влияет на балл</h4>
      <ul class="mt-2 space-y-1.5 text-[13px] leading-snug text-stone-600 dark:text-zinc-300">
        <li v-for="factor in details.factors.value" :key="factor" class="flex items-start gap-2">
          <i class="pi pi-info-circle mt-0.5 shrink-0 text-[12px] text-amber-500" aria-hidden="true" />
          <span class="min-w-0">{{ factor }}</span>
        </li>
      </ul>

      <Message severity="info" :closable="false" class="!rounded-2xl !mt-4 !text-xs">
        <div class="flex items-start gap-2">
          <i class="pi pi-shield mt-0.5 shrink-0" aria-hidden="true" />
          <div class="min-w-0 leading-snug">
            <span class="font-black">Кажется, вас специально «минусуют»?</span>
            Обжалование бесплатно — напишите нам: <span class="font-bold">{{ details.appealHint }}</span>, расскажите что случилось. Посмотрим жалобы, отзывы и блокировки и вернём баллы при травле или ошибке.
          </div>
        </div>
      </Message>

      <Link :href="details.faqHref" class="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
        <span>Что это значит — раздел FAQ</span>
        <i class="pi pi-arrow-right text-[11px]" aria-hidden="true" />
      </Link>

      <Button label="Закрыть" rounded outlined severity="secondary" class="w-full mt-4" @click="details.close()" />
    </section>
  </Dialog>
</template>

<style scoped>
/* Мобила: шторка снизу на всю ширину — шкала и факторы
   читаются как лист, safe-area под home-индикатором учтена. */
@media (max-width: 639.98px) {
  .reputation-sheet {
    margin: 0 0 env(safe-area-inset-bottom, 0px) !important;
    border-radius: 28px 28px 0 0 !important;
    max-height: 92dvh;
  }
}
</style>
