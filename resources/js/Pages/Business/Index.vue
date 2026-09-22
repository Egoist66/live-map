<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { h } from 'vue'
import BusinessLayout from '@/Layouts/BusinessLayout.vue'
import BusinessStatCard from '@/Components/Features/Business/BusinessStatCard.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import AccountTypeGateModal from '@/Components/Features/Business/AccountTypeGateModal.vue'
import { useBusinessDashboard } from '@/composables/useBusinessDashboard'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import type { BusinessDashboard } from '@/types/entities/Business'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(BusinessLayout, () => child),
})

const props = defineProps<{ initialDashboard?: BusinessDashboard | null }>()

useSeo({ title: 'Кабинет бизнеса — UPin', description: 'Просмотры, пины и заработок компании на карте.', noindex: true })

const dash = useBusinessDashboard()

if (props.initialDashboard && !dash.store.dashboard) {
  dash.store.dashboard = props.initialDashboard
  dash.store.profile = props.initialDashboard.business
}
</script>

<template>
  <Head title="Кабинет бизнеса" />
  <div class="space-y-4 pb-2">
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-[22px] sm:text-[26px] font-black tracking-tight dark:text-white truncate">
          {{ dash.store.profile?.name ?? 'Мой бизнес' }}
        </h1>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-0.5">Карта приводит клиентов — кабинет показывает сколько и что дальше</p>
      </div>
      <BusinessVerificationBadge :status="dash.store.profile?.verification_status ?? 'draft'" />
    </div>

    <Message v-if="dash.store.profile?.verification_status === 'rejected'" severity="error" class="w-full">
      Проверка отклонена: {{ dash.store.profile?.verification_notes ?? 'исправьте реквизиты' }}. Обновите данные и отправьте снова.
    </Message>

    <Message v-if="dash.needsVerification.value" severity="warn" class="w-full">
      Пройдите проверку по УНП — откроются бейдж «Проверено», бессрочные пины и пуш-рассылка.
      <Link href="/business/onboarding" class="font-bold underline ml-1">Заполнить реквизиты →</Link>
    </Message>

    <div v-if="dash.store.loading && !dash.store.dashboard" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Skeleton v-for="i in 4" :key="i" height="92px" class="!rounded-[20px]" />
    </div>
    <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <BusinessStatCard
        v-for="card in dash.cards.value"
        :key="card.key"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
      />
    </div>

    <div class="grid lg:grid-cols-[1fr_360px] gap-3 items-start">
      <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #title><span class="text-[16px] font-black dark:text-white">Как заработать на карте</span></template>
        <template #content>
          <div class="space-y-2.5">
            <div
              v-for="hint in dash.store.earnHints"
              :key="hint.key"
              class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5"
            >
              <div class="text-sm font-bold dark:text-white">{{ hint.title }}</div>
              <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">{{ hint.text }}</div>
            </div>
            <div v-if="!dash.store.earnHints.length" class="text-sm text-stone-500 dark:text-zinc-400">Подсказок пока нет — создайте первый пин.</div>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row gap-2">
            <Link href="/map" class="flex-1"><Button label="Создать пин на карте" icon="pi pi-map-marker" class="w-full !rounded-full !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-0" /></Link>
            <Link href="/business/onboarding" class="flex-1"><Button label="Реквизиты компании" icon="pi pi-id-card" outlined class="w-full !rounded-full" /></Link>
          </div>
        </template>
      </Card>

      <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #title><span class="text-[16px] font-black dark:text-white">Последние пины</span></template>
        <template #content>
          <div v-if="!dash.recentPins.value.length" class="text-sm text-stone-500 dark:text-zinc-400">Пинов пока нет — первый пин даёт +15 к репутации и первых клиентов.</div>
          <div v-else class="space-y-2">
            <Link
              v-for="pin in dash.recentPins.value"
              :key="pin.id"
              href="/map"
              class="block rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-2.5 hover:border-indigo-400 transition"
            >
              <div class="text-sm font-bold truncate dark:text-white">{{ pin.title }}</div>
              <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Просмотры: {{ pin.views_count ?? 0 }} · Лайки: {{ pin.likes_count ?? 0 }} · Комменты: {{ pin.comments_count ?? 0 }}</div>
            </Link>
          </div>
          <Button
            label="Обновить цифры"
            icon="pi pi-refresh"
            text
            rounded
            size="small"
            class="mt-3"
            :loading="dash.store.loading"
            @click="dash.refresh()"
          />
        </template>
      </Card>
    </div>
  </div>
  <AccountTypeGateModal mode="auth" />
</template>
