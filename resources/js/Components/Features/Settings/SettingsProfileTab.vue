<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import UpdateProfileInformationForm from '@/Pages/Profile/Partials/UpdateProfileInformationForm.vue'
import DatingRatingStars from '@/Components/Features/Dating/DatingRatingStars.vue'
import ReputationDetailsDialog from '@/Components/Features/Settings/ReputationDetailsDialog.vue'
import { useReputationDetails } from '@/composables/useReputationDetails'
import { useUloveOnly } from '@/composables/useUloveOnly'

defineProps<{ mustVerifyEmail: boolean; status?: string | null; bioEmpty: boolean; bioText: string }>()

/**
 * Единый источник данных про звёзды и репутацию: и карточкам,
 * и диалогу сведений — один хук, без двойных запросов.
 */
const reputationDetails = useReputationDetails()
const rating = reputationDetails.rating
const trust = reputationDetails.trust
/** Чистый ULove: bio нигде не показывается — и превью прячем вместе с полем. */
const uloveOnly = useUloveOnly()
</script>
<template>
  <div class="space-y-4">
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Основное</h3>
        <UpdateProfileInformationForm :must-verify-email="mustVerifyEmail" :status="status" class="mt-5 max-w-xl" />
      </template>
    </Card>
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Мой рейтинг</h3>
        <div v-if="rating.loading.value" class="mt-3 flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
          <i class="pi pi-spin pi-spinner" aria-label="Загрузка рейтинга" /> Грузим рейтинг…
        </div>
        <div v-else-if="rating.hasRatings.value" class="mt-3">
          <DatingRatingStars :avg="rating.average.value" :count="rating.count.value" tone="light" />
          <p class="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">Среднее всех оценок<span v-if="rating.isHidden.value"> · скрыт от других (PRO)</span></p>
        </div>
        <p v-else class="mt-3 text-sm text-stone-500 dark:text-zinc-400">Пока без оценок — тебя оценят после общения.</p>
      </template>
    </Card>
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Моя репутация</h3>
        <div v-if="trust.loading.value" class="mt-3 flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
          <i class="pi pi-spin pi-spinner" aria-label="Загрузка репутации" /> Грузим репутацию…
        </div>
        <div v-else-if="trust.score.value != null" class="mt-3 flex items-center gap-3">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-xl font-black text-white shadow">{{ trust.score.value }}</span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-black text-stone-900 dark:text-white">{{ trust.score.value }} из 10 · {{ trust.label.value }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">{{ trust.hint.value }}</div>
          </div>
        </div>
        <Button label="Сведения о репутации" icon="pi pi-shield" rounded outlined severity="secondary" size="small" class="mt-3 w-full sm:w-auto" @click="reputationDetails.open()" />
      </template>
    </Card>
    <ReputationDetailsDialog :details="reputationDetails" />
    <Card v-if="!bioEmpty && !uloveOnly" class="!bg-white dark:!bg-[#0F121F] !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h4 class="text-sm font-black flex items-center gap-2">Превью «О себе» <Tag value="как видят другие" class="!text-xs !font-normal !bg-stone-100 !text-stone-500 !border-0" /></h4>
        <div class="mt-3 bg-stone-50 border rounded-3xl p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-700">{{ bioText }}</div>
      </template>
    </Card>
  </div>
</template>
