<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Avatar from 'primevue/avatar'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useGlobalPeopleSearch } from '@/composables/useGlobalPeopleSearch'
import { useGlobalDistrictSearch } from '@/composables/useGlobalDistrictSearch'
import { useChatSearchList } from '@/composables/useChatSearchUser'
import { useEnterToSend } from '@/composables/useEnterToSend'
import { usePeopleSearchStore } from '@/stores/peopleSearch'
import type { GlobalSearchTab } from '@/stores/peopleSearch'
import DistrictSearchList from '@/Components/Features/Districts/DistrictSearchList.vue'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { computed } from 'vue'

const search = useGlobalPeopleSearch()
const districts = useGlobalDistrictSearch()
const peopleStore = usePeopleSearchStore()
const { isDesktop } = useEnterToSend()
const { isFriend, isPending, showAdd, addTitle } = useChatSearchList()
const peopleHasMore = computed(() => peopleStore.peopleHasMore)
const peopleLoadingMore = computed(() => peopleStore.loadingMorePeople)
const { sentinel: peopleSentinel } = useInfiniteScroll({ hasMore: peopleHasMore, loading: peopleLoadingMore, onLoadMore: () => peopleStore.loadMorePeople() })
const districtsHasMore = computed(() => peopleStore.districtsHasMore)
const districtsLoadingMore = computed(() => peopleStore.loadingMoreDistricts)
const { sentinel: districtsSentinel } = useInfiniteScroll({ hasMore: districtsHasMore, loading: districtsLoadingMore, onLoadMore: () => peopleStore.loadMoreDistricts() })

/**
 * Переключить таб глобального поиска.
 * @param value значение таба «people» или «districts»
 */
function onTab(value: string | number | undefined): void {
  if (value === 'people' || value === 'districts') {
    peopleStore.setActiveTab(value as GlobalSearchTab)
  }
}
</script>
<template>
  <Dialog
    :visible="search.open.value"
    @update:visible="(v: boolean) => { if (!v) search.close() }"
    modal
    header="Поиск"
    :style="{ width: '480px', maxWidth: '96vw', maxHeight: '92dvh' }"
    :pt="{ header: { class: '!pb-1' }, content: { class: '!pt-2 !max-h-[80dvh] !overflow-y-auto' } }"
  >
    <Tabs :value="peopleStore.activeTab" @update:value="onTab">
      <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
        <Tab value="people" class="!text-[13px] !font-bold">
          <span class="flex items-center gap-1.5"><i class="pi pi-users text-xs" />Люди</span>
        </Tab>
        <Tab value="districts" class="!text-[13px] !font-bold">
          <span class="flex items-center gap-1.5"><i class="pi pi-map-marker text-xs" />Районы</span>
        </Tab>
      </TabList>

      <TabPanels class="!p-0 !pt-3 !bg-transparent">
        <TabPanel value="people">
          <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">
            Найди человека по имени
          </div>

          <div class="relative w-full">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
            <InputText
              :model-value="search.query.value"
              @update:model-value="search.setQuery(String($event ?? ''))"
              placeholder="Имя, например Петр..."
              :autofocus="isDesktop"
              enterkeyhint="search"
              fluid
              class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30"
            />
            <i
              v-if="search.searching.value"
              class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none"
            />
          </div>

          <div
            v-if="search.results.value.length"
            class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm"
          >
            <div
              v-for="u in search.results.value"
              :key="u.id"
              @click="search.openProfile(u.id)"
              @keydown.enter="search.openProfile(u.id)"
              tabindex="0"
              role="link"
              class="flex items-center justify-between p-3 select-none cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition rounded-xl"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="relative shrink-0">
                  <Avatar
                    :image="avatarSrcFor(u)"
                    shape="circle"
                    size="normal"
                    class="!w-9 !h-9 [&_img]:object-cover"
                  />
                  <OnlineDot
                    :online="search.isOnline(u.id, u.last_seen_at)"
                    size="w-3 h-3"
                  />
                </span>
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate dark:text-white">{{ u.name }}</div>
                </div>
              </div>

              <div class="flex gap-1.5 shrink-0 ml-2 items-center">
                <Button
                  v-if="u.can_message !== false"
                  @click.stop="search.startChat(u)"
                  :loading="search.creating.value"
                  rounded
                  title="Написать сообщение"
                  aria-label="Написать сообщение"
                  icon="pi pi-send"
                  class="!w-9 !h-9 !p-0"
                />
                <Button
                  v-if="showAdd(u)"
                  @click.stop="search.addFriend(u.id)"
                  rounded
                  severity="info"
                  text
                  :title="addTitle(u)"
                  :aria-label="addTitle(u)"
                  icon="pi pi-user-plus"
                  class="!w-9 !h-9 !p-0"
                />
                <span
                  v-else-if="isPending(u)"
                  :title="addTitle(u)"
                  class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500"
                >
                  <i class="pi pi-clock text-sm" />
                </span>
                <span
                  v-else-if="isFriend(u)"
                  :title="addTitle(u)"
                  class="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  <i class="pi pi-check text-sm" />
                </span>
                <Button
                  @click.stop="search.askBlock(u.id, u.name)"
                  rounded
                  severity="danger"
                  text
                  title="Заблокировать"
                  aria-label="Заблокировать"
                  icon="pi pi-ban"
                  class="!w-9 !h-9 !p-0"
                />
              </div>
            </div>
          </div>

          <div
            v-else-if="search.hasQuery.value && !search.searching.value"
            class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400"
          >
            Ничего не найдено
          </div>
          <div
            v-else
            class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500"
          >
            Введи имя для поиска
          </div>
        </TabPanel>

        <TabPanel value="districts">
          <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">
            Найди район, вступи и знакомься внутри — пины и чат открыты жителям
          </div>

          <div class="relative w-full">
            <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
            <InputText
              :model-value="districts.districtQuery.value"
              @update:model-value="districts.setQuery(String($event ?? ''))"
              placeholder="Название района..."
              :autofocus="isDesktop"
              enterkeyhint="search"
              fluid
              class="!rounded-full !pl-10 !pr-10 !py-2.5 !text-base lg:!text-sm !border-stone-200 dark:!border-zinc-700 focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/30"
            />
            <i
              v-if="districts.districtSearching.value"
              class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none"
            />
          </div>

          <div
            v-if="districts.districtResults.value.length"
            class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm"
          >
            <DistrictSearchList :rows="districts.districtResults.value" @open="(id) => districts.openDistrict(id)" @chat="(row) => districts.openChat(row)" />`r`n            <InfiniteSentinel :sentinel="districtsSentinel" :has-more="peopleStore.districtsHasMore" :loading="peopleStore.loadingMoreDistricts" />
          </div>

          <div
            v-else-if="districts.hasQuery.value && !districts.districtSearching.value"
            class="mt-4 text-center py-6 text-sm text-stone-500 dark:text-zinc-400"
          >
            Ничего не найдено — попробуй другой запрос
          </div>
          <div
            v-else-if="districts.suggestedDistricts.value.length || districts.districtSuggestionsLoading.value"
            class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y divide-stone-100 dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm"
          >
            <div class="px-3 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-stone-400 dark:text-zinc-500">Существующие районы</div>
            <div v-if="districts.districtSuggestionsLoading.value && !districts.suggestedDistricts.value.length" class="p-4 text-center"><i class="pi pi-spin pi-spinner text-violet-400 text-sm" /></div>
            <DistrictSearchList :rows="districts.suggestedDistricts.value" @open="(id) => districts.openDistrict(id)" @chat="(row) => districts.openChat(row)" />
          </div>
          <div
            v-else
            class="mt-4 text-center py-6 text-xs text-stone-400 dark:text-zinc-500"
          >
            Введи название района для поиска
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>
