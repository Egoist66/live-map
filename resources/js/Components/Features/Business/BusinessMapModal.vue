<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { storeToRefs } from 'pinia'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useBusinessMarkersStore } from '@/stores/businessMarkers'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

const businessMarkersStore = useBusinessMarkersStore()
const { closeCompany, openCompanyPin } = businessMarkersStore
const { modalVisible, opened, companyPins, pinsLoading, pinsError } = storeToRefs(businessMarkersStore)

function badgeStatus(): BusinessVerificationStatus {
  return opened.value?.is_verified ? 'verified' : 'draft'
}
</script>

<template>
  <Dialog
    v-model:visible="modalVisible"
    modal
    :draggable="false"
    :show-header="false"
    position="center"
    :style="{ width: '560px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!border-0 overflow-hidden !bg-white dark:!bg-[#0F121F] shadow-2xl !rounded-[28px] max-sm:!rounded-b-none' },
      content: { class: '!p-0 !bg-white dark:!bg-[#0F121F]' },
    }"
    @hide="closeCompany()"
  >
    <div v-if="opened" class="max-h-[86dvh] overflow-y-auto overscroll-contain">
      <div class="relative overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 px-5 sm:px-6 pt-5 pb-5 text-white">
        <div class="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-violet-500/30 blur-[50px] pointer-events-none"></div>
        <div class="relative flex items-start gap-3">
          <span class="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 grid place-items-center text-2xl shrink-0 overflow-hidden">
            <img v-if="opened.logo_url" :src="opened.logo_url" :alt="opened.name" class="w-full h-full object-cover" />
            <span v-else>🏢</span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-black text-[18px] leading-tight truncate">{{ opened.name }}</div>
            <div v-if="opened.category || opened.address" class="text-[12px] text-white/70 mt-0.5 truncate">
              {{ opened.category ?? '' }}{{ opened.category && opened.address ? ' · ' : '' }}{{ opened.address ?? '' }}
            </div>
          </div>
          <BusinessVerificationBadge :status="badgeStatus()" class="shrink-0" />
        </div>
      </div>

      <div class="px-4 sm:px-5 py-4">
        <div class="text-[13px] font-black uppercase tracking-wide text-stone-500 dark:text-zinc-400">
          Пины компании · {{ opened.pins_count }}
        </div>

        <div v-if="pinsLoading" class="mt-2.5 space-y-2">
          <Skeleton v-for="i in 3" :key="i" height="58px" class="!rounded-2xl" />
        </div>
        <p v-else-if="pinsError" class="mt-2.5 text-sm text-red-500">{{ pinsError }}</p>
        <div v-else-if="!companyPins.length" class="mt-2.5 text-sm text-stone-500 dark:text-zinc-400">
          Пока нет активных пинов — загляните позже.
        </div>
        <div v-else class="mt-2.5 space-y-2">
          <button
            v-for="pin in companyPins"
            :key="pin.id"
            type="button"
            class="w-full text-left rounded-2xl border border-stone-200 dark:border-white/10 px-3.5 py-2.5 hover:border-indigo-400 transition active:scale-[0.99]"
            @click="openCompanyPin(pin)"
          >
            <div class="text-sm font-bold truncate dark:text-white">{{ pin.title }}</div>
            <div v-if="pin.promo" class="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">📢 {{ pin.promo }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Просмотры: {{ pin.views_count ?? 0 }} · Лайки: {{ pin.likes_count ?? 0 }} · Показать →</div>
          </button>
        </div>

        <div class="mt-4 flex flex-col sm:flex-row gap-2 pb-[calc(0.25rem+var(--sab))]">
          <Link
            v-if="opened.owner_profile"
            :href="`/users/${opened.owner_profile}`"
            class="flex-1"
          >
            <Button label="Профиль компании" icon="pi pi-building" outlined class="w-full !rounded-full" />
          </Link>
          <Button label="Закрыть" text rounded class="flex-1" @click="closeCompany()" />
        </div>
      </div>
    </div>
  </Dialog>
</template>
