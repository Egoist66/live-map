<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import Badge from 'primevue/badge'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useAdminMonitoring } from '@/composables/useAdminMonitoring'
import { useAdminUsers } from '@/composables/useAdminUsers'
import { useAdminReports } from '@/composables/useAdminReports'
import AdminStatsCards from '@/Components/Features/Admin/AdminStatsCards.vue'
import AdminActivityChart from '@/Components/Features/Admin/AdminActivityChart.vue'
import AdminOnlineList from '@/Components/Features/Admin/AdminOnlineList.vue'
import AdminUsersManager from '@/Components/Features/Admin/AdminUsersManager.vue'
import AdminUpdatesManager from '@/Components/Features/Admin/AdminUpdatesManager.vue'
import AdminImpersonateDialog from '@/Components/Features/Admin/AdminImpersonateDialog.vue'
import AdminImpersonationLogs from '@/Components/Features/Admin/AdminImpersonationLogs.vue'
import AdminLoginAttempts from '@/Components/Features/Admin/AdminLoginAttempts.vue'
import AdminMaintenanceManager from '@/Components/Features/Admin/AdminMaintenanceManager.vue'
import AdminReferencesManager from '@/Components/Features/Admin/AdminReferencesManager.vue'
import SettingsAdminTab from '@/Components/Features/Settings/SettingsAdminTab.vue'
import { useAdminReference } from '@/composables/useAdminReference'
import { useAdminAppUpdates } from '@/composables/useAdminAppUpdates'
import { useAdminImpersonate } from '@/composables/useAdminImpersonate'
import { useAdminImpersonationLogs } from '@/composables/useAdminImpersonationLogs'
import { useAdminLoginAttempts } from '@/composables/useAdminLoginAttempts'
import { useAppMaintenance } from '@/composables/useAppMaintenance'
import { onMounted, ref } from 'vue'

const tab = ref('stats')

const mon = useAdminMonitoring()
const admin = useAdminUsers()
const reports = useAdminReports()
const appUpdates = useAdminAppUpdates()
const imp = useAdminImpersonate()
const impLogs = useAdminImpersonationLogs()
const logins = useAdminLoginAttempts()
const maintenance = useAppMaintenance()
const refs = useAdminReference()
reports.init()
onMounted(() => appUpdates.load())
onMounted(() => impLogs.load())
onMounted(() => logins.load())
onMounted(() => maintenance.load())
onMounted(() => refs.load())
</script>
<template>
  <Head title="Админ-панель" />
  <AuthenticatedLayout>
    <Toast />
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[1280px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <Card class="!bg-stone-900 dark:!bg-zinc-900 !text-white !border-0 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex flex-wrap items-center gap-3 overflow-hidden">
              <span class="w-11 h-11 rounded-2xl bg-white/10 text-white grid place-items-center shrink-0"><i class="pi pi-shield" /></span>
              <div class="min-w-0 flex-1">
                <h1 class="text-lg sm:text-2xl font-black tracking-tight">Админ-панель</h1>
                <p class="text-white/50 text-xs sm:text-sm">Мониторинг онлайна, статистика роста и модерация.</p>
              </div>
              <Button label="Мой профиль" rounded outlined size="small" class="!text-white !border-white/30 hover:!bg-white hover:!text-stone-900 !text-xs !font-bold [&_.p-button-label]:hidden min-[420px]:[&_.p-button-label]:inline" @click="router.visit('/profile')" />
              <Button icon="pi pi-refresh" rounded class="!bg-white !text-stone-900 !border-white !text-sm !font-bold [&_.p-button-label]:hidden min-[420px]:[&_.p-button-label]:inline" :loading="mon.loadingOverview.value" label="Обновить" @click="mon.refreshAll()" />
            </div>
          </template>
        </Card>

        <AdminStatsCards :overview="mon.overview.value" :pct="mon.onlinePct.value" :loading="mon.loadingOverview.value" />

        <Tabs v-model:value="tab" class="min-w-0 admin-tabs">
          <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
            <Tab value="stats" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-chart-bar text-xs" /><span class="tab-label">Статистика</span></span></Tab>
            <Tab value="manage" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-users text-xs" /><span class="tab-label">Управление</span></span></Tab>
            <Tab value="security" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-shield text-xs" /><span class="tab-label">Безопасность</span><Badge v-if="logins.stats.value.failed_today" :value="logins.stats.value.failed_today > 99 ? '99+' : String(logins.stats.value.failed_today)" severity="danger" /></span></Tab>
            <Tab value="admin" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-cog text-xs" /><span class="tab-label">Администрирование</span><Badge v-if="reports.pendingCount.value" :value="reports.pendingCount.value > 99 ? '99+' : String(reports.pendingCount.value)" severity="danger" /></span></Tab>
            <Tab value="refs" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-book text-xs" /><span class="tab-label">Справочники</span></span></Tab>
          </TabList>
          <TabPanels class="!p-0 !pt-4 !bg-transparent">
            <TabPanel value="stats">
              <div class="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 items-start">
                <AdminActivityChart :points="mon.points.value" :max="mon.maxChart.value" :days="mon.chartDays.value" :loading="mon.loadingChart.value" :summary="mon.summary.value" :exporting="mon.exporting.value" @days="(v:number)=>mon.chartDays.value=v" @export="mon.exportExcel()" />
                <AdminOnlineList
                  :list="mon.online.value" :meta="mon.onlineMeta.value" :page="mon.onlinePage.value" :limit="mon.onlineLimit.value" :query="mon.onlineQuery.value" :loading="mon.loadingOnline.value"
                  @update:query="(v:string)=>mon.onlineQuery.value=v" @limit="(v:number)=>mon.setOnlineLimit(v as any)" @page="mon.setOnlinePage"
                />
              </div>
            </TabPanel>
            <TabPanel value="manage">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminUsersManager
                  :list="mon.users.value" :meta="mon.usersMeta.value" :page="mon.usersPage.value" :query="mon.usersQuery.value" :filter="mon.usersFilter.value" :sort="mon.usersSort.value" :limit="mon.usersLimit.value" :loading="mon.loadingUsers.value" :acting-id="mon.actingId.value" :admin="admin" :auth-user-id="mon.authUserId.value"
                  @update:query="(v:string)=>mon.usersQuery.value=v" @filter="(v:string)=>mon.setUsersFilter(v as any)" @sort="(v:string)=>mon.usersSort.value=v as any" @page="mon.setUsersPage"
                  @plan="mon.setPlan" @role="mon.requestRoleChange" @impersonate="imp.ask" @ban="(u:any)=>logins.ban(u)" @unban="(u:any)=>logins.unban(u)"
                />
                <div class="space-y-4 min-w-0">
                  <AdminUpdatesManager :mgr="appUpdates" />
                  <AdminMaintenanceManager :mgr="maintenance" />
                </div>
              </div>
            </TabPanel>
            <TabPanel value="security">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminLoginAttempts :attempts="logins" />
                <AdminImpersonationLogs :logs="impLogs" />
              </div>
            </TabPanel>
            <TabPanel value="admin">
              <SettingsAdminTab :admin="admin" :reports="reports" :imp="imp" />
            </TabPanel>
            <TabPanel value="refs">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminReferencesManager :mgr="refs" />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <AdminImpersonateDialog :imp="imp" />
      <Dialog :visible="!!mon.pendingSelfRole.value" @update:visible="(v:boolean)=>{ if(!v) mon.cancelSelfRoleChange() }" modal header="Снять с себя права?" :style="{ width: '400px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600 dark:text-zinc-300">Сменить свою роль с <b>admin</b> на <b>{{ mon.pendingSelfRole.value?.role }}</b>? Ты потеряешь доступ к админ-панели.</p>
        <template #footer>
          <Button label="Отмена" text @click="mon.cancelSelfRoleChange()" />
          <Button label="Снять права" severity="danger" :loading="mon.actingId.value !== null" @click="mon.confirmSelfRoleChange()" />
        </template>
      </Dialog>
      <Dialog :visible="!!admin.confirmDelete.value" @update:visible="(v:boolean)=>{ if(!v) admin.closeConfirm() }" modal header="Удалить аккаунт?" :style="{ width: '400px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600 dark:text-zinc-300">Удалить <b>{{ admin.confirmDelete.value?.name }}</b> ({{ admin.confirmDelete.value?.email }})? Это нельзя отменить.</p>
        <template #footer>
          <Button label="Отмена" text @click="admin.closeConfirm()" />
          <Button label="Удалить" severity="danger" :loading="admin.deletingId.value !== null" @click="admin.doDelete()" />
        </template>
      </Dialog>
    </div>
  </AuthenticatedLayout>
</template>
