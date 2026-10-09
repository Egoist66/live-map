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
const SettingsStatsTab = defineAsyncComponent(() => import('@/Components/Features/Settings/SettingsStatsTab.vue'))
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
      <TabList :ref="(el:any)=>appTabs.bindScroller(el)" :class="['app-subtabs', { 'can-left': appTabs.canLeft.value, 'can-right': appTabs.canRight.value }]" :pt="{ activeBar: { class: '!hidden' } }">
        <Tab v-for="t in appTabs.tabs" :key="t.id" :value="t.id" class="app-subtab">
          <span class="app-subtab-pill" :class="{ 'is-active': appTabs.active.value === t.id }" :title="t.desc">
            <i :class="[t.icon, 'text-sm leading-none']" aria-hidden="true" />
            <span>{{ t.label }}</span>
          </span>
        </Tab>
      </TabList>
      <TabPanels class="!bg-transparent !p-0 !pt-3 !min-w-0">
        <TabPanel value="sections" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
            <template #content>
              <h3 class="font-black tracking-tight text-lg dark:text-white">Разделы приложения</h3>
              <div class="mt-4 max-w-xl">
                <SettingsModulesSection />
              </div>
            </template>
          </Card>
        </TabPanel>
        <TabPanel value="notify" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
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
        <TabPanel value="stats" class="!min-w-0">
          <SettingsStatsTab v-if="appTabs.active.value === 'stats'" />
        </TabPanel>
        <TabPanel value="install" class="!min-w-0">
          <SettingsAppInstallSection />
        </TabPanel>
        <TabPanel value="telegram" class="!min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
            <template #content>
              <h3 class="font-black tracking-tight text-lg dark:text-white">Telegram</h3>
              <p class="text-sm text-stone-500 mt-1">Привязка второго аккаунта к боту.</p>
              <div class="mt-5 max-w-xl">
                <TelegramAccountSwitch />
              </div>
            </template>
          </Card>
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
/* Лента пилюль: горизонтальный скролл с momentum на таче, стрелки
   PrimeVue скрыты — жест и свайп вместо них. Цвета пилюль заданы
   явно под обе темы (html.dark), а не только dark:-утилитами:
   так их не перебивает тема PrimeVue. ВАЖНО: фон даёт сам
   `.p-tablist` (корень!), а не контент — сбрасываем оба, иначе
   в тёмной теме за пилюлями белая полоса. */
.app-subtabs,
html.dark .app-subtabs {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}
.app-subtabs :deep(.p-tablist-content) {
  display: flex !important;
  gap: 0.5rem !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  background: transparent !important;
  border: 0 !important;
  padding: 2px 2px 6px !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scroll-padding-inline: 2px;
}
.app-subtabs :deep(.p-tablist-content::-webkit-scrollbar) {
  display: none !important;
}
/* Живое затухание краёв: видно куда можно мотать.
   -webkit-префикс обязателен для iOS Safari. */
.app-subtabs.can-left :deep(.p-tablist-content) {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px);
  mask-image: linear-gradient(to right, transparent 0, #000 28px);
}
.app-subtabs.can-right :deep(.p-tablist-content) {
  -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px);
  mask-image: linear-gradient(to left, transparent 0, #000 28px);
}
.app-subtabs.can-left.can-right :deep(.p-tablist-content) {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
}
.app-subtabs :deep(.p-tablist-prev-button),
.app-subtabs :deep(.p-tablist-next-button) {
  display: none !important;
}
.app-subtabs :deep(.p-tab.app-subtab) {
  padding: 0 !important;
  margin: 0 !important;
  min-width: 0 !important;
  flex-shrink: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  scroll-snap-align: start;
}
.app-subtabs :deep(.p-tab.app-subtab:hover) {
  background: transparent !important;
}
.app-subtabs :deep(.p-tab.app-subtab:focus-visible) {
  outline: 2px solid #f43f5e !important;
  outline-offset: 2px;
  border-radius: 9999px;
}
.app-subtab-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 44px;
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid #e7e5e4;
  background: #ffffff;
  color: #57534e;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  transition: transform 0.15s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.app-subtab-pill:active {
  transform: scale(0.95);
}
.app-subtab-pill.is-active {
  background: #f43f5e;
  border-color: #f43f5e;
  color: #ffffff;
  box-shadow: 0 6px 18px -6px rgba(244, 63, 94, 0.55);
}
html.dark .app-subtab-pill {
  background: #18181b;
  border-color: #3f3f46;
  color: #d4d4d8;
}
html.dark .app-subtab-pill.is-active {
  background: #f43f5e;
  border-color: #fb7185;
  color: #ffffff;
  box-shadow: 0 6px 20px -6px rgba(244, 63, 94, 0.65);
}
/* Мобила: компактнее пилюли, хвост-спейсер чтобы последняя
   не обрезалась у края; snap по пилюлям. */
@media (max-width: 640px) {
  .app-subtabs :deep(.p-tablist-content) {
    margin-inline: -2px;
    padding-right: 10px !important;
    scroll-snap-type: x proximity;
  }
  .app-subtab-pill {
    min-height: 40px;
    padding: 0.45rem 0.75rem;
    font-size: 12.5px;
  }
  .app-subtab-pill i {
    font-size: 13px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-subtab-pill {
    transition: none;
  }
}
</style>
