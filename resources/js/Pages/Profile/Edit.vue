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
import SettingsProceduresTab from '@/Components/Features/Settings/SettingsProceduresTab.vue'
import SettingsSupportTab from '@/Components/Features/Settings/SettingsSupportTab.vue'
import SettingsAppTab from '@/Components/Features/Settings/SettingsAppTab.vue'
import SettingsAdminTab from '@/Components/Features/Settings/SettingsAdminTab.vue'
import AdminImpersonateDialog from '@/Components/Features/Admin/AdminImpersonateDialog.vue'
import AvatarPreview from '@/Components/Features/Media/AvatarPreview.vue'
import Toast from 'primevue/toast'
import { planOf } from '@/composables/usePlanLimits'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'

const props = defineProps<{ mustVerifyEmail: boolean; status?: string | null; user: any; initialTab?: string | null }>()
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
          <SettingsSidebar :menu-model="s.menuModel.value" :plan="planOf(s.u.value)" :pins-today="s.u.value.pins_today_count || 0" :pins-limit="planOf(s.u.value) === 'free' ? '3' : '∞'" :zone-count="s.zoneCount.value" :proc-unread="s.proc.unread.value" @billing="s.active.value = 'billing'" />
          <div class="space-y-4 min-w-0 w-full max-w-full lg:min-h-[600px] self-start">
            <Tabs :value="s.active.value" @update:value="(v:any)=>{ if (typeof v === 'string') (s.setActive as any)(v) }" class="settings-root w-full !mt-0">
              <TabList class="!flex lg:!hidden !bg-transparent !border-0 !gap-2 !px-1 settings-tabs" :pt="{ activeBar: { class: '!hidden' }, content: { class: '!flex !flex-wrap !gap-2 !overflow-visible' } }">
                <Tab v-for="t in s.tabs.value" :key="t.id" :value="t.id" class="!bg-transparent !border-0 !p-0 !shrink-0">
                  <div :class="['flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition whitespace-nowrap', s.active.value === t.id ? '!bg-violet-600 !text-white !border-violet-600 shadow-soft' : 'bg-white text-stone-700 border-stone-200']">
                    <i :class="[t.icon, 'text-xs']" /><span>{{ t.label }}</span><span v-if="t.id === 'procedures' && s.proc.unread.value" class="text-red-500 leading-none">❗</span>
                  </div>
                </Tab>
              </TabList>
              <TabPanels class="!bg-transparent !p-0">
                <TabPanel value="profile"><SettingsProfileTab :must-verify-email="mustVerifyEmail" :status="status" :bio-empty="s.bioPreviewEmpty.value" :bio-text="s.bioPreviewText.value" /></TabPanel>
                <TabPanel value="billing"><SettingsBillingTab :user="s.u.value" :zone-count="s.zoneCount.value" @profile="s.active.value = 'profile'" /></TabPanel>
                <TabPanel value="pins"><SettingsMyPinsTab :pins="(s.myPins.value as any)" :loading="(s.loadingPins.value as any)" :deleting="false" :updating-id="(s.updatingId as any)?.value ?? null" :format-date="formatDate" :format-time="formatTime" @delete="s.deleteMyPin" @audience="(id: number, v: string) => (s.updateAudience as any)(id, v)" /></TabPanel>
                <TabPanel value="privacy"><SettingsPrivacyTab :user="s.u.value" :invisible="s.invisible" :hidden="s.hidden" :blur="s.blur" :photo-privacy="s.photoPrivacy" @profile="s.active.value = 'profile'" /></TabPanel>
                <TabPanel value="appearance"><SettingsAppearanceTab :theme="s.theme.value" @theme="setTheme" /></TabPanel>
                <TabPanel value="security"><SettingsSecurityTab /></TabPanel>
                <TabPanel v-if="(s.showProcedures as any).value" value="procedures"><SettingsProceduresTab :proc="s.proc" /></TabPanel>
                <TabPanel value="support"><SettingsSupportTab :subject="s.support.supportSubject.value" @update:subject="(v:string)=>s.support.supportSubject.value=v" :body="s.support.supportBody.value" @update:body="(v:string)=>s.support.supportBody.value=v" :donate-sel="s.support.donateSel.value" @update:donate="s.support.setDonate" :rate="s.ex.usdRate.value" :rate-loading="s.ex.loading.value" @send="s.support.mailToSupport()" @donate="s.support.mailToDonate(s.ex)" @reload="s.ex.load" /></TabPanel>
                <TabPanel value="app"><SettingsAppTab /></TabPanel>
                <TabPanel v-if="s.isAdmin.value" value="admin"><SettingsAdminTab :admin="s.admin" :reports="s.reports" :imp="s.imp" /></TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        </div>
      </div>
      <AvatarPreview :src="s.avatarSrc.value" :name="s.u.value.name" :open="s.showAvatar.value" @close="s.showAvatar.value = false" />
      <AdminImpersonateDialog :imp="s.imp" />
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
