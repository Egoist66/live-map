<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head } from '@inertiajs/vue3'
import { useTheme } from '@/composables/useTheme'
import { useSettingsPage } from '@/composables/useSettingsPage'
import { formatDate, formatTime } from '@/utils/date'
import SettingsSidebar from '@/Components/Features/Settings/SettingsSidebar.vue'
import SettingsProfileTab from '@/Components/Features/Settings/SettingsProfileTab.vue'
import SettingsBillingTab from '@/Components/Features/Settings/SettingsBillingTab.vue'
import SettingsMyPinsTab from '@/Components/Features/Settings/SettingsMyPinsTab.vue'
import SettingsPrivacyTab from '@/Components/Features/Settings/SettingsPrivacyTab.vue'
import SettingsAppearanceTab from '@/Components/Features/Settings/SettingsAppearanceTab.vue'
import SettingsSecurityTab from '@/Components/Features/Settings/SettingsSecurityTab.vue'
import SettingsSupportTab from '@/Components/Features/Settings/SettingsSupportTab.vue'
import SettingsAppTab from '@/Components/Features/Settings/SettingsAppTab.vue'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import Toast from 'primevue/toast'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'

const props = defineProps<{ mustVerifyEmail: boolean; status?: string | null; user: any }>()
const s = useSettingsPage(props)
const { setTheme } = useTheme()
</script>
<template>
  <Head title="Настройки" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[1280px] mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-hidden">
        <div class="grid lg:grid-cols-[300px_1fr] gap-4 sm:gap-6 items-start content-start w-full lg:items-start">
          <SettingsSidebar :menu-model="s.menuModel.value" :plan="s.u.value.plan || 'free'" :pins-today="s.u.value.pins_today_count || 0" :pins-limit="s.u.value.plan === 'free' ? '3' : '∞'" :zone-count="s.zoneCount.value" @billing="s.active.value = 'billing'" />
          <div class="space-y-4 min-w-0 w-full max-w-full lg:min-h-[600px] self-start">
            <Tabs :value="s.activeIndex.value" @update:value="(v:any)=>{ const e=s.tabs[Number(v)]; if(e) s.active.value=e.id as any }" class="settings-root w-full !mt-0">
              <TabList class="!flex lg:!hidden !bg-transparent !border-0 !gap-2 !px-1 settings-tabs" :pt="{ activeBar: { class: '!hidden' }, content: { class: '!flex !flex-wrap !gap-2 !overflow-visible' } }">
                <Tab v-for="(t, idx) in s.tabs" :key="t.id" :value="String(idx)" class="!bg-transparent !border-0 !p-0 !shrink-0">
                  <div :class="['flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition whitespace-nowrap', s.active.value === t.id ? '!bg-violet-600 !text-white !border-violet-600 shadow-soft' : 'bg-white text-stone-700 border-stone-200']">
                    <i :class="[t.icon, 'text-xs']" /><span>{{ t.label }}</span>
                  </div>
                </Tab>
              </TabList>
              <TabPanels class="!bg-transparent !p-0">
                <TabPanel value="0"><SettingsProfileTab :must-verify-email="mustVerifyEmail" :status="status" :bio-empty="s.bioPreviewEmpty.value" :bio-text="s.bioPreviewText.value" /></TabPanel>
                <TabPanel value="1"><SettingsBillingTab :user="s.u.value" :zone-count="s.zoneCount.value" @profile="s.active.value = 'profile'" /></TabPanel>
                <TabPanel value="2"><SettingsMyPinsTab :pins="(s.myPins.value as any)" :loading="(s.loadingPins.value as any)" :deleting="false" :format-date="formatDate" :format-time="formatTime" @delete="s.deleteMyPin" /></TabPanel>
                <TabPanel value="3"><SettingsPrivacyTab :user="s.u.value" :invisible="s.invisible" @profile="s.active.value = 'profile'" /></TabPanel>
                <TabPanel value="4"><SettingsAppearanceTab :theme="s.theme.value" @theme="setTheme" /></TabPanel>
                <TabPanel value="5"><SettingsSecurityTab /></TabPanel>
                <TabPanel value="6"><SettingsSupportTab :subject="s.support.supportSubject.value" @update:subject="(v:string)=>s.support.supportSubject.value=v" :body="s.support.supportBody.value" @update:body="(v:string)=>s.support.supportBody.value=v" :donate-sel="s.support.donateSel.value" @update:donate="s.support.setDonate" :rate="s.ex.usdRate.value" :rate-loading="s.ex.loading.value" @send="s.support.mailToSupport()" @donate="s.support.mailToDonate(s.ex)" @reload="s.ex.load" /></TabPanel>
                <TabPanel value="7"><SettingsAppTab /></TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
      <AvatarPreview :src="s.avatarSrc.value" :name="s.u.value.name" :open="s.showAvatar.value" @close="s.showAvatar.value = false" />
    </div>
  </AuthenticatedLayout>
</template>
<style scoped>
.settings-root {
  gap: 20px !important;
}
.settings-tabs :deep(.p-tablist-content),
.settings-tabs :deep(.p-tablist-tab-list) {
  overflow: visible !important;
  flex-wrap: wrap !important;
  scrollbar-width: none !important;
}
.settings-tabs :deep(.p-tablist-content::-webkit-scrollbar),
.settings-tabs :deep(.p-tablist-tab-list::-webkit-scrollbar) {
  display: none !important;
}
.settings-tabs :deep(.p-tablist-prev-button),
.settings-tabs :deep(.p-tablist-next-button) {
  display: none !important;
}
</style>
