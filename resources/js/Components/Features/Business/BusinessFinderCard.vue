<script setup lang="ts">
import { ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useOrganizationSearch } from '@/composables/useOrganizationSearch'
import { useGlobalDistrictSearch } from '@/composables/useGlobalDistrictSearch'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import DistrictSearchList from '@/Components/Features/Districts/DistrictSearchList.vue'

const tab = ref<'organizations' | 'districts'>('organizations')
const orgs = useOrganizationSearch()
const districts = useGlobalDistrictSearch()
</script>
<template>
  <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
    <template #title>
      <span class="flex items-center justify-between gap-2">
        <span class="text-[16px] font-black dark:text-white">Поиск в приложении</span>
        <i class="pi pi-search text-sm text-stone-400 dark:text-zinc-500" />
      </span>
    </template>
    <template #content>
      <Tabs :value="tab" @update:value="(v:string|number|undefined)=>{ if (v === 'organizations' || v === 'districts') tab = v }">
        <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
          <Tab value="organizations" class="!text-[13px] !font-bold">
            <span class="flex items-center gap-1.5"><i class="pi pi-briefcase text-xs" />Организации</span>
          </Tab>
          <Tab value="districts" class="!text-[13px] !font-bold">
            <span class="flex items-center gap-1.5"><i class="pi pi-map-marker text-xs" />Районы</span>
          </Tab>
        </TabList>
        <TabPanels class="!p-0 !pt-3 !bg-transparent">
          <TabPanel value="organizations">
            <div class="relative w-full">
              <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
              <InputText :model-value="orgs.orgQuery.value" @update:model-value="orgs.setQuery(String($event ?? ''))" placeholder="Название или бренд…" enterkeyhint="search" fluid class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30" />
              <i v-if="orgs.orgSearching.value" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
            </div>
            <div v-if="orgs.orgResults.value.length" class="mt-3 max-h-[320px] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-sm">
              <button
                v-for="org in orgs.orgResults.value"
                :key="org.id"
                type="button"
                class="w-full flex items-center gap-2.5 p-3 select-none text-left hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition active:scale-[0.99]"
                @click="orgs.openCompany(org)"
              >
                <span class="relative shrink-0 grid place-items-center w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <img v-if="org.logo_url" :src="org.logo_url" :alt="orgs.displayName(org)" class="w-full h-full object-cover" loading="lazy" />
                  <span v-else class="text-sm">🏢</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium truncate text-stone-900 dark:text-white">{{ orgs.displayName(org) }}</span>
                  <span v-if="orgs.displayCaption(org)" class="block text-[11px] truncate text-stone-500 dark:text-zinc-400">{{ orgs.displayCaption(org) }}</span>
                </span>
                <BusinessVerificationBadge :status="org.is_verified ? 'verified' : 'draft'" class="shrink-0" />
              </button>
            </div>
            <div v-else-if="orgs.hasQuery.value && !orgs.orgSearching.value" class="mt-3 text-center py-5 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено — попробуй другой запрос</div>
            <div v-else class="mt-3 text-center py-5 text-xs text-stone-400 dark:text-zinc-500">Введи название компании или бренд</div>
          </TabPanel>
          <TabPanel value="districts">
            <div class="relative w-full">
              <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
              <InputText :model-value="districts.districtQuery.value" @update:model-value="districts.setQuery(String($event ?? ''))" placeholder="Название района…" enterkeyhint="search" fluid class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30" />
              <i v-if="districts.districtSearching.value" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
            </div>
            <div v-if="districts.districtResults.value.length" class="mt-3 max-h-[320px] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-sm">
              <DistrictSearchList :rows="districts.districtResults.value" @open="districts.openDistrict" @chat="districts.openChat" />
            </div>
            <div v-else-if="districts.hasQuery.value && !districts.districtSearching.value" class="mt-3 text-center py-5 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено — попробуй другой запрос</div>
            <div v-else class="mt-3 text-center py-5 text-xs text-stone-400 dark:text-zinc-500">Вступи в район — реклама сможет выйти к его жителям</div>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Link href="/map" class="mt-3 block"><Button label="Открыть карту" icon="pi pi-map-marker" outlined size="small" rounded class="w-full !rounded-full" /></Link>
    </template>
  </Card>
</template>
