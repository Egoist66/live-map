<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useSettingsAppTabs } from '@/composables/useSettingsAppTabs'
// Каждая смысловая секция — отдельный чанк: грузится только при первом
// открытии своей подвкладки (в паре с `lazy` у Tabs ниже).
const PwaPushToggle = defineAsyncComponent(() => import('@/Components/Features/Pwa/PwaPushToggle.vue'))
const TelegramNotifySettings = defineAsyncComponent(() => import('@/Components/Features/Settings/TelegramNotifySettings.vue'))
const TelegramAccountSwitch = defineAsyncComponent(() => import('@/Components/Features/Settings/TelegramAccountSwitch.vue'))
const SettingsModulesSection = defineAsyncComponent(() => import('@/Components/Features/Settings/SettingsModulesSection.vue'))
const SettingsAppInstallSection = defineAsyncComponent(() => import('@/Components/Features/Settings/SettingsAppInstallSection.vue'))
const SettingsHotkeysSection = defineAsyncComponent(() => import('@/Components/Features/Settings/SettingsHotkeysSection.vue'))
const SavedNotesSettingsSection = defineAsyncComponent(() => import('@/Components/Features/Settings/SavedNotesSettingsSection.vue'))
// Гайд-диалог — только по клику «Как установить», грузим лениво.
const PwaInstallGuideDialog = defineAsyncComponent(() => import('@/Components/Features/Pwa/PwaInstallGuideDialog.vue'))

/**
 * Раздел «Приложение»: смысловые подвкладки вместо простыни.
 * Активная подвкладка и её список — в useSettingsAppTabs (Правило №1).
 */
const appTabs = useSettingsAppTabs()
</script>

<template>
  <div class="space-y-4 min-w-0">
    <Tabs :value="appTabs.active.value" lazy @update:value="(v:any)=>{ if (typeof v === 'string') appTabs.setActive(v as any) }" class="w-full !mt-0">
      <TabList class="app-subtabs" :pt="{ activeBar: { class: '!hidden' } }">
        <Tab v-for="t in appTabs.tabs" :key="t.id" :value="t.id" class="!bg-transparent !border-0 !p-0 !m-0 !min-w-0">
          <div
            :title="t.desc"
            :class="['flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-bold whitespace-nowrap transition active:scale-95', appTabs.active.value === t.id ? '!bg-[#f43f5e] !border-[#f43f5e] !text-white shadow-md shadow-rose-500/30' : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-800']"
          >
            <i :class="[t.icon, 'text-sm leading-none']" />
            <span>{{ t.label }}</span>
          </div>
        </Tab>
      </TabList>
      <TabPanels class="!bg-transparent !p-0 !pt-3 !min-w-0">
        <TabPanel value="sections" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
            <template #content>
              <h3 class="font-black tracking-tight text-lg dark:text-white">Разделы приложения</h3>
              <p class="text-sm text-stone-500 mt-1">Что видно в меню и какой раздел стартовый.</p>
              <div class="mt-5 max-w-xl">
                <SettingsModulesSection />
              </div>
            </template>
          </Card>
        </TabPanel>
        <TabPanel value="notify" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
            <template #content>
              <h3 class="font-black tracking-tight text-lg dark:text-white">Уведомления</h3>
              <p class="text-sm text-stone-500 mt-1">Пуши на этом устройстве и сообщения бота Telegram.</p>
              <div class="mt-5 space-y-4 max-w-xl">
                <PwaPushToggle />
                <TelegramNotifySettings />
              </div>
            </template>
          </Card>
        </TabPanel>
        <TabPanel value="install" class="!min-w-0">
          <SettingsAppInstallSection />
        </TabPanel>
        <TabPanel value="telegram" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
            <template #content>
              <h3 class="font-black tracking-tight text-lg dark:text-white">Telegram</h3>
              <p class="text-sm text-stone-500 mt-1">Привязка второго аккаунта к боту.</p>
              <div class="mt-5 max-w-xl">
                <TelegramAccountSwitch />
              </div>
            </template>
          </Card>
        </TabPanel>
        <TabPanel value="notes" class="!min-w-0">
          <SavedNotesSettingsSection />
        </TabPanel>
        <TabPanel value="hotkeys" class="!min-w-0">
          <SettingsHotkeysSection />
        </TabPanel>
      </TabPanels>
    </Tabs>
    <PwaInstallGuideDialog />
  </div>
</template>

<style scoped>
.app-subtabs :deep(.p-tablist-content) {
  display: flex !important;
  gap: 0.5rem !important;
  overflow-x: auto !important;
  background: transparent !important;
  border: 0 !important;
  padding: 2px !important;
  scrollbar-width: none !important;
}
.app-subtabs :deep(.p-tablist-content::-webkit-scrollbar) {
  display: none !important;
}
.app-subtabs :deep(.p-tab) {
  padding: 0 !important;
  margin: 0 !important;
  min-width: 0 !important;
  flex-shrink: 0 !important;
  background: transparent !important;
  border: 0 !important;
}
.app-subtabs :deep(.p-tablist-prev-button),
.app-subtabs :deep(.p-tablist-next-button) {
  display: none !important;
}
</style>
