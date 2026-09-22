<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { h } from 'vue'
import BusinessLayout from '@/Layouts/BusinessLayout.vue'
import BusinessStatCard from '@/Components/Features/Business/BusinessStatCard.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
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
    <section class="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 text-white shadow-float">
      <img v-if="dash.store.profile?.cover_url" :src="dash.store.profile.cover_url" alt="" aria-hidden="true" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-indigo-950/85 via-indigo-950/45 to-indigo-950/25"></div>
      <div class="absolute inset-0 pointer-events-none" style="background-image: radial-gradient(circle at 85% 15%, rgba(255,255,255,.14) 0 2px, transparent 3px), radial-gradient(circle at 70% 80%, rgba(255,255,255,.10) 0 2px, transparent 3px); background-size: 72px 72px;"></div>
      <div class="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-500/30 blur-[70px] pointer-events-none"></div>
      <div class="relative p-5 sm:p-7">
        <div class="flex flex-wrap items-start gap-4">
          <span class="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 grid place-items-center text-2xl shrink-0 backdrop-blur overflow-hidden">
            <img v-if="dash.store.profile?.logo_url" :src="dash.store.profile.logo_url" alt="Логотип компании" class="w-full h-full object-cover" />
            <span v-else>🏢</span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-bold tracking-[0.18em] uppercase text-white/60">Кабинет компании</div>
            <h1 class="text-[22px] sm:text-[28px] font-black tracking-tight leading-tight truncate">
              {{ dash.store.profile?.name ?? 'Моя компания' }}
            </h1>
            <p class="text-[13px] text-white/70 mt-1 truncate">
              УНП {{ dash.store.profile?.unp ?? '—' }} · {{ dash.store.profile?.address ?? dash.store.profile?.legal_address ?? 'адрес не указан' }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-2 shrink-0">
            <BusinessVerificationBadge :status="dash.store.profile?.verification_status ?? 'draft'" />
            <Link v-if="dash.store.profile?.owner_profile" :href="`/users/${dash.store.profile.owner_profile}`" class="text-[12px] font-bold text-white/80 hover:text-white underline underline-offset-2">Как видят клиенты →</Link>
          </div>
        </div>

        <div class="mt-5 flex items-center gap-1.5 sm:gap-2">
          <template v-for="(stepItem, stepIndex) in dash.verificationSteps.value" :key="stepItem.label">
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0" :class="stepIndex < 2 ? 'flex-1' : ''">
              <span
                :class="[
                  'w-6 h-6 rounded-full grid place-items-center text-[11px] font-black shrink-0',
                  stepItem.state === 'done' ? 'bg-emerald-400 text-indigo-950' : stepItem.state === 'active' ? 'bg-white text-indigo-900' : 'bg-white/15 text-white/60',
                ]"
              >
                <span v-if="stepItem.state === 'done'">✓</span>
                <span v-else>{{ stepIndex + 1 }}</span>
              </span>
              <span :class="['text-[12px] sm:text-[13px] font-semibold truncate', stepItem.state === 'todo' ? 'text-white/50' : 'text-white']">{{ stepItem.label }}</span>
              <span v-if="stepIndex < 2" class="flex-1 h-px bg-white/20 min-w-[12px]" />
            </div>
          </template>
        </div>

        <div class="mt-5 flex flex-col sm:flex-row gap-2">
          <Link href="/map" class="flex-1"><Button label="Создать пин на карте" icon="pi pi-map-marker" class="w-full !bg-white !text-indigo-950 !border-0 !rounded-full !font-bold hover:!bg-indigo-50" /></Link>
          <Link href="/cabinet/onboarding" class="flex-1"><Button label="Реквизиты компании" icon="pi pi-id-card" outlined class="w-full !border-white/30 !text-white !rounded-full !font-semibold hover:!bg-white/10" /></Link>
        </div>
      </div>
    </section>

    <Message v-if="dash.store.profile?.verification_status === 'rejected'" severity="error" class="w-full">
      Проверка отклонена: {{ dash.store.profile?.verification_notes ?? 'исправьте реквизиты' }}. Обновите данные и отправьте снова.
    </Message>

    <Message v-if="dash.needsVerification.value && dash.store.profile?.verification_status !== 'rejected'" severity="warn" class="w-full">
      Пройдите проверку по УНП — откроются бейдж «Проверено», бессрочные пины и пуш-рассылка.
      <Link href="/cabinet/onboarding" class="font-bold underline ml-1">Заполнить реквизиты →</Link>
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
        <template #title><span class="text-[16px] font-black dark:text-white">Продвижение</span></template>
        <template #content>
          <div class="space-y-2.5">
            <div
              v-for="(hint, hintIndex) in dash.store.earnHints"
              :key="hint.key"
              class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5 flex gap-3"
            >
              <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-[13px] font-black shrink-0">{{ hintIndex + 1 }}</span>
              <div class="min-w-0">
                <div class="text-sm font-bold dark:text-white">{{ hint.title }}</div>
                <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">{{ hint.text }}</div>
              </div>
            </div>
            <div v-if="!dash.store.earnHints.length" class="text-sm text-stone-500 dark:text-zinc-400">Подсказок пока нет — создайте первый пин.</div>
          </div>
        </template>
      </Card>

      <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #title>
          <span class="flex items-center justify-between gap-2">
            <span class="text-[16px] font-black dark:text-white">Пины компании</span>
            <Link v-if="(dash.store.stats?.pins_total ?? 0) > 0" href="/cabinet/pins" class="text-[12px] font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-80">Все {{ dash.store.stats?.pins_total }} →</Link>
          </span>
        </template>
        <template #content>
          <div v-if="!dash.recentPins.value.length" class="rounded-2xl border-2 border-dashed border-stone-200 dark:border-zinc-700 p-4 text-center">
            <div class="text-sm font-bold dark:text-white">Пинов пока нет</div>
            <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1">Первый пин приводит первых клиентов с карты.</div>
            <Link href="/map" class="inline-block mt-3"><Button label="Создать первый пин" icon="pi pi-map-marker" size="small" rounded class="!bg-gradient-to-r !from-indigo-500 !to-violet-600 !border-0 !text-white" /></Link>
          </div>
          <div v-else class="space-y-2">
            <Link
              v-for="pin in dash.recentPins.value"
              :key="pin.id"
              :href="`/map?pin=${pin.id}`"
              class="block rounded-2xl border border-stone-200 dark:border-zinc-700 px-3.5 py-2.5 hover:border-indigo-400 transition active:scale-[0.99]"
            >
              <div class="text-sm font-bold truncate dark:text-white">{{ pin.title }}</div>
              <div v-if="pin.promo" class="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">📢 {{ pin.promo }}</div>
              <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Просмотры: {{ pin.views_count ?? 0 }} · Лайки: {{ pin.likes_count ?? 0 }} · Открыть →</div>
            </Link>
          </div>
          <div class="mt-2 flex items-center gap-1">
            <Button
              label="Обновить"
              icon="pi pi-refresh"
              text
              rounded
              size="small"
              :loading="dash.store.loading"
              @click="dash.refresh()"
            />
            <Link v-if="(dash.store.stats?.pins_total ?? 0) > 5" href="/cabinet/pins"><Button label="Все пины" text rounded size="small" /></Link>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
