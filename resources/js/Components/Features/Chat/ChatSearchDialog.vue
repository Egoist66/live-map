<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Avatar from 'primevue/avatar'
import InputText from 'primevue/inputtext'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import OrgBadge from '@/Components/Features/Chat/OrgBadge.vue'
import DistrictSearchList from '@/Components/Features/Districts/DistrictSearchList.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useChatSearchList } from '@/composables/useChatSearchUser'
import { useGlobalDistrictSearch } from '@/composables/useGlobalDistrictSearch'
import { useOrganizationSearch } from '@/composables/useOrganizationSearch'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useEnterToSend } from '@/composables/useEnterToSend'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { usePeopleSearchStore } from '@/stores/peopleSearch'
import type { GlobalSearchTab } from '@/stores/peopleSearch'

const { isDesktop } = useEnterToSend()

defineProps<{ open: boolean; query: string; results: any[]; searching: boolean; creating: boolean; isOnline: (id?: number, lastSeenAt?: string | null) => boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'update:query', v: string): void; (e: 'chat', u: any): void; (e: 'add', id: number): void; (e: 'block', id: number, name?: string): void }>()
const { isFriend, isPending, showAdd, addTitle } = useChatSearchList()
const districts = useGlobalDistrictSearch()
const orgs = useOrganizationSearch()
const peopleStore = usePeopleSearchStore()
const { userProfileUrl } = useProfileUrl()

/**
 * Переключить таб поиска.
 * @param value значение таба «people», «districts» или «organizations»
 */
function onTab(value: string | number | undefined): void {
  if (value === 'people' || value === 'districts' || value === 'organizations') {
    peopleStore.setActiveTab(value as GlobalSearchTab)
  }
}

/**
 * Открыть район и закрыть локальный диалог.
 * @param id id района
 */
function goDistrict(id: number): void {
  emit('update:open', false)
  districts.openDistrict(id)
}
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal header="Поиск" :style="{ width: '480px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700' }, header: { class: '!pb-1' }, title: { class: 'dark:!text-white' }, content: { class: '!pt-2 !max-h-[80dvh] !overflow-y-auto !bg-white dark:!bg-zinc-900' } }">
    <Tabs :value="peopleStore.activeTab" @update:value="onTab">
      <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
        <Tab value="people" class="!text-[13px] !font-bold">
          <span class="flex items-center gap-1.5"><i class="pi pi-users text-xs" />Люди</span>
        </Tab>
        <Tab value="districts" class="!text-[13px] !font-bold">
          <span class="flex items-center gap-1.5"><i class="pi pi-map-marker text-xs" />Районы</span>
        </Tab>
        <Tab value="organizations" class="!text-[13px] !font-bold">
          <span class="flex items-center gap-1.5"><i class="pi pi-briefcase text-xs" />Организации</span>
        </Tab>
      </TabList>

      <TabPanels class="!p-0 !pt-3 !bg-transparent">
        <TabPanel value="people">
          <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">Найди человека по имени чтобы начать чат — отдельный глобальный поиск</div>
          <div class="relative w-full">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
            <InputText :model-value="query" @update:model-value="emit('update:query', String($event ?? ''))" placeholder="Имя, например Петр..." :autofocus="isDesktop" enterkeyhint="search" fluid class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30" />
            <i v-if="searching" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
          </div>
          <div v-if="results.length" class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
            <div v-for="u in results" :key="u.id" class="flex items-center justify-between p-3 select-none">
              <Link :href="userProfileUrl(u)" class="flex items-center gap-2.5 min-w-0">
                <span class="relative shrink-0"><Avatar :image="avatarSrcFor(u)" shape="circle" size="normal" class="!w-9 !h-9 [&_img]:object-cover" /><OnlineDot :online="isOnline(u.id, u.last_seen_at)" size="w-3 h-3" /></span>
                <div class="min-w-0"><div class="text-sm font-medium truncate text-stone-900 dark:text-white">{{ u.name }} <OrgBadge :is-organization="u.is_organization" /></div></div>
              </Link>
              <div class="flex gap-1.5 shrink-0 ml-2 items-center">
                <button v-if="u.can_message !== false" @click="emit('chat', u)" :disabled="creating" title="Написать сообщение" aria-label="Написать сообщение" class="w-9 h-9 grid place-items-center rounded-full bg-ink-900 text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-zinc-900"><i class="pi pi-send text-sm" /></button>
                <button v-if="showAdd(u)" @click.stop="emit('add', u.id)" :title="addTitle(u)" :aria-label="addTitle(u)" class="w-9 h-9 grid place-items-center rounded-full bg-blue-600/10 text-blue-600 transition hover:bg-blue-600/20 active:scale-95 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25"><i class="pi pi-user-plus text-sm" /></button>
                <button v-else-if="isPending(u)" :title="addTitle(u)" :aria-label="addTitle(u)" disabled class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 text-stone-400 cursor-default dark:bg-zinc-800 dark:text-zinc-500"><i class="pi pi-clock text-sm" /></button>
                <span v-else :title="addTitle(u)" class="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><i class="pi pi-check text-sm" /></span>
                <button @click.stop="emit('block', u.id, u.name)" title="Заблокировать" aria-label="Заблокировать" class="w-9 h-9 grid place-items-center rounded-full bg-red-500/10 text-red-600 transition hover:bg-red-500/20 active:scale-95 dark:text-red-400 dark:hover:bg-red-500/20"><i class="pi pi-ban text-sm" /></button>
              </div>
            </div>
          </div>
          <div v-else-if="query && !searching" class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено</div>
          <div v-else class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500">Введи имя для поиска</div>
        </TabPanel>

        <TabPanel value="districts">
          <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">Найди район, вступи и знакомься внутри — пины и чат открыты жителям</div>
          <div class="relative w-full">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
            <InputText :model-value="districts.districtQuery.value" @update:model-value="districts.setQuery(String($event ?? ''))" placeholder="Название района..." enterkeyhint="search" fluid class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30" />
            <i v-if="districts.districtSearching.value" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
          </div>
          <div v-if="districts.districtResults.value.length" class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm">
            <DistrictSearchList :rows="districts.districtResults.value" @open="goDistrict" @chat="(row) => { emit('update:open', false); districts.openChat(row) }" />
          </div>
          <div v-else-if="districts.hasQuery.value && !districts.districtSearching.value" class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено — попробуй другой запрос</div>
          <div v-else-if="districts.suggestedDistricts.value.length || districts.districtSuggestionsLoading.value" class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm">
            <div class="px-3 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-stone-400 dark:text-zinc-500">Существующие районы</div>
            <div v-if="districts.districtSuggestionsLoading.value && !districts.suggestedDistricts.value.length" class="p-4 text-center"><i class="pi pi-spin pi-spinner text-violet-400 text-sm" /></div>
            <DistrictSearchList :rows="districts.suggestedDistricts.value" @open="goDistrict" @chat="(row) => { emit('update:open', false); districts.openChat(row) }" />
          </div>
          <div v-else class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500">Введи название района для поиска</div>
        </TabPanel>

        <TabPanel value="organizations">
          <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">Найди компанию по названию или бренду — откроем её профиль</div>
          <div class="relative w-full">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
            <InputText :model-value="orgs.orgQuery.value" @update:model-value="orgs.setQuery(String($event ?? ''))" placeholder="Название или бренд…" enterkeyhint="search" fluid class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30" />
            <i v-if="orgs.orgSearching.value" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
          </div>
          <div v-if="orgs.orgResults.value.length" class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
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
          <div v-else-if="orgs.hasQuery.value && !orgs.orgSearching.value" class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено — попробуй другой запрос</div>
          <div v-else class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500">Введи название компании или бренд</div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>
