<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { computed } from 'vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useBusinessPublicPage } from '@/composables/useBusinessPublicPage'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

interface PublicBusiness {
  id: number
  name: string
  category: string | null
  address: string | null
  lat: number | null
  lng: number | null
  description: string | null
  phone: string | null
  website: string | null
  working_hours: Record<string, string> | null
  is_verified: boolean
  logo_url: string | null
}

const props = defineProps<{
  business: PublicBusiness
  owner: { id: number; name: string; avatar_url: string | null; last_seen_at: string | null }
  isOwn: boolean
  canMessage: boolean
  canMessageReason: string | null
  isBlocked?: boolean
  isBlockedBy?: boolean
}>()

useSeo({ title: `${props.business.name} — компания на карте`, description: props.business.description ?? 'Профиль компании.', noindex: true })

const page = useBusinessPublicPage(props.owner.id)

const badgeStatus = computed<BusinessVerificationStatus>(() => (props.business.is_verified ? 'verified' : 'draft'))

const workingHours = computed(() => {
  const hours = props.business.working_hours
  if (!hours || typeof hours !== 'object') {
    return []
  }
  return Object.entries(hours).filter(([, value]) => String(value ?? '').trim() !== '')
})

const websiteHref = computed(() => {
  const raw = String(props.business.website ?? '').trim()
  if (raw === '') {
    return null
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw
  }
  return `https://${raw}`
})
</script>

<template>
  <Head :title="business.name" />
  <div class="max-w-[760px] mx-auto space-y-3 pb-2">
    <section class="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 text-white shadow-float">
      <div class="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-500/30 blur-[70px] pointer-events-none"></div>
      <div class="relative p-5 sm:p-7">
        <div class="flex flex-wrap items-start gap-4">
          <span class="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 grid place-items-center text-2xl shrink-0 overflow-hidden">
            <img v-if="business.logo_url" :src="business.logo_url" :alt="business.name" class="w-full h-full object-cover" />
            <span v-else>🏢</span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-bold tracking-[0.18em] uppercase text-white/60">Компания</div>
            <h1 class="text-[22px] sm:text-[28px] font-black tracking-tight leading-tight">{{ business.name }}</h1>
            <p v-if="business.category || business.address" class="text-[13px] text-white/70 mt-1 truncate">
              {{ business.category ?? '' }}{{ business.category && business.address ? ' · ' : '' }}{{ business.address ?? '' }}
            </p>
          </div>
          <BusinessVerificationBadge :status="badgeStatus" class="shrink-0" />
        </div>

        <div class="mt-5 flex flex-col sm:flex-row gap-2">
          <template v-if="isOwn">
            <Link href="/cabinet" class="flex-1"><Button label="Мой кабинет" icon="pi pi-briefcase" class="w-full !bg-white !text-indigo-950 !border-0 !rounded-full !font-bold hover:!bg-indigo-50" /></Link>
          </template>
          <template v-else>
            <Button
              label="Написать компании"
              icon="pi pi-comments"
              class="flex-1 !bg-white !text-indigo-950 !border-0 !rounded-full !font-bold hover:!bg-indigo-50"
              :loading="page.writing.value"
              :disabled="!canMessage"
              :title="canMessageReason ?? undefined"
              @click="page.writeToCompany()"
            />
          </template>
        </div>
        <p v-if="!isOwn && !canMessage && canMessageReason" class="mt-2 text-[12px] text-white/60">{{ canMessageReason }}</p>
      </div>
    </section>

    <Message v-if="isBlockedBy" severity="error" class="w-full">Компания ограничила связь — профиль скрыт.</Message>

    <template v-else>
      <Card v-if="business.description" class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #content>
          <div class="font-black text-[16px] dark:text-white">О компании</div>
          <p class="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-zinc-300 whitespace-pre-line">{{ business.description }}</p>
        </template>
      </Card>

      <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #content>
          <div class="font-black text-[16px] dark:text-white">Контакты</div>
          <div class="mt-3 space-y-2">
            <a v-if="business.phone" :href="`tel:${business.phone.replace(/[^+\d]/g, '')}`" class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3 hover:border-indigo-400 transition">
              <i class="pi pi-phone text-indigo-500 shrink-0" />
              <span class="text-sm font-semibold dark:text-white">{{ business.phone }}</span>
            </a>
            <a v-if="websiteHref" :href="websiteHref" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3 hover:border-indigo-400 transition">
              <i class="pi pi-globe text-indigo-500 shrink-0" />
              <span class="text-sm font-semibold dark:text-white truncate">{{ business.website }}</span>
            </a>
            <div v-if="business.address" class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-700 px-4 py-3">
              <i class="pi pi-map-marker text-indigo-500 shrink-0" />
              <span class="text-sm font-semibold dark:text-white">{{ business.address }}</span>
            </div>
            <div v-if="!business.phone && !websiteHref && !business.address" class="text-sm text-stone-500 dark:text-zinc-400">Контакты пока не указаны.</div>
          </div>
        </template>
      </Card>

      <Card v-if="workingHours.length" class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
        <template #content>
          <div class="font-black text-[16px] dark:text-white">Часы работы</div>
          <div class="mt-3 space-y-1.5">
            <div v-for="[day, hours] in workingHours" :key="day" class="flex items-center justify-between gap-3 text-sm">
              <span class="text-stone-500 dark:text-zinc-400">{{ day }}</span>
              <span class="font-semibold dark:text-white text-right">{{ hours }}</span>
            </div>
          </div>
        </template>
      </Card>
    </template>
  </div>
</template>
