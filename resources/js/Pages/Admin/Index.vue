<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import Badge from 'primevue/badge'
import Message from 'primevue/message'
import InputText from 'primevue/inputtext'
import InputOtp from 'primevue/inputotp'
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
import AdminBusinessManager from '@/Components/Features/Admin/AdminBusinessManager.vue'
import AdminUpdatesManager from '@/Components/Features/Admin/AdminUpdatesManager.vue'
import AdminImpersonateDialog from '@/Components/Features/Admin/AdminImpersonateDialog.vue'
import AdminImpersonationLogs from '@/Components/Features/Admin/AdminImpersonationLogs.vue'
import AdminLoginAttempts from '@/Components/Features/Admin/AdminLoginAttempts.vue'
import AdminMaintenanceManager from '@/Components/Features/Admin/AdminMaintenanceManager.vue'
import AdminReferencesManager from '@/Components/Features/Admin/AdminReferencesManager.vue'
import AdminSeoManager from '@/Components/Features/Admin/AdminSeoManager.vue'
import SettingsAdminTab from '@/Components/Features/Settings/SettingsAdminTab.vue'
import { useAdminReference } from '@/composables/useAdminReference'
import { useAdminSeo } from '@/composables/useAdminSeo'
import { useAdminAppUpdates } from '@/composables/useAdminAppUpdates'
import { useAdminImpersonate } from '@/composables/useAdminImpersonate'
import { useAdminImpersonationLogs } from '@/composables/useAdminImpersonationLogs'
import { useAdminLoginAttempts } from '@/composables/useAdminLoginAttempts'
import { useAppMaintenance } from '@/composables/useAppMaintenance'
import { useAdminAccess } from '@/composables/useAdminAccess'
import { useAdminBusiness } from '@/composables/useAdminBusiness'
import { useAdminTabs } from '@/composables/useAdminTabs'
import { useStaffRole } from '@/composables/useStaffRole'
import { onMounted, watch } from 'vue'

const staff = useStaffRole()
const { tab, setTab } = useAdminTabs()

const mon = useAdminMonitoring()
const admin = useAdminUsers()
const reports = useAdminReports()
const businessQueue = useAdminBusiness()
const appUpdates = useAdminAppUpdates()
const imp = useAdminImpersonate()
const impLogs = useAdminImpersonationLogs()
const logins = useAdminLoginAttempts()
const maintenance = useAppMaintenance()
const refs = useAdminReference()
const seo = useAdminSeo()
const access = useAdminAccess()

/**
 * Подтянуть данные панели после открытия гейта.
 *
 * До ввода пароля ничего чувствительного не грузим.
 * Модератору грузим только его табы (Статистика, Модерация,
 * Справочники, SEO): Управление и Безопасность — лишь админам.
 */
function loadAll(): void {
  reports.init()
  businessQueue.init()
  void refs.load()
  void seo.load()
  if (!staff.isAdmin.value) return
  void appUpdates.load()
  void impLogs.load()
  void logins.load()
  void maintenance.load()
}

/**
 * Модератора без полных прав выкидываем с закрытых табов.
 *
 * Срабатывает и при прямом заходе по ?tab=manage.
 */
function enforceVisibleTab(): void {
  if (!staff.isAdmin.value && !staff.canViewTab(tab.value)) setTab('stats')
}

onMounted(() => void access.check())
watch(
  () => access.unlocked.value,
  (v) => {
    if (v) loadAll()
  },
)
watch(tab, (v) => {
  if (!staff.isAdmin.value && !staff.canViewTab(v)) {
    setTab('stats')
    return
  }
  if (v === 'security' && access.unlocked.value) void logins.openTab()
})
enforceVisibleTab()
</script>
<template>
  <Head title="Панель модерации" />
  <Toast />
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[1280px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <Card class="!bg-stone-900 dark:!bg-zinc-900 !text-white !border-0 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex flex-wrap items-center gap-3 overflow-hidden">
              <span class="w-11 h-11 rounded-2xl bg-white/10 text-white grid place-items-center shrink-0"><i class="pi pi-shield" /></span>
              <div class="min-w-0 flex-1">
                <h1 class="text-lg sm:text-2xl font-black tracking-tight">Панель модерации</h1>
                <p class="text-white/50 text-xs sm:text-sm">Мониторинг онлайна, статистика роста и модерация.</p>
              </div>
              <Button label="Мой профиль" rounded outlined size="small" class="!text-white !border-white/30 hover:!bg-white hover:!text-stone-900 !text-xs !font-bold [&_.p-button-label]:hidden min-[420px]:[&_.p-button-label]:inline" @click="router.visit('/profile')" />
              <Button icon="pi pi-refresh" rounded class="!bg-white !text-stone-900 !border-white !text-sm !font-bold [&_.p-button-label]:hidden min-[420px]:[&_.p-button-label]:inline" :loading="mon.loadingOverview.value" label="Обновить" @click="mon.refreshAll()" />
              <Button v-if="access.unlocked.value" icon="pi pi-lock" rounded outlined size="small" aria-label="Закрыть панель" title="Закрыть панель до следующего ввода пароля" class="!text-white !border-white/30 hover:!bg-white hover:!text-stone-900 !w-8 !h-8 !p-0" @click="access.lock()" />
            </div>
          </template>
        </Card>

        <template v-if="!access.unlocked.value">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-8 sm:!p-10' }, content: { class: '!p-0 text-center' } }">
            <template #content>
              <div class="mx-auto w-14 h-14 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 grid place-items-center"><i class="pi pi-lock text-xl" /></div>
              <div class="mt-4 text-lg font-black dark:text-white">{{ access.checking.value ? 'Проверяем доступ…' : 'Панель закрыта' }}</div>
              <div v-if="!access.checking.value" class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Введи код из почты, чтобы открыть модерацию.</div>
            </template>
          </Card>
        </template>
        <template v-else>
        <AdminStatsCards :overview="mon.overview.value" :pct="mon.onlinePct.value" :loading="mon.loadingOverview.value" />

        <Tabs v-model:value="tab" class="min-w-0 admin-tabs">
          <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
            <Tab value="stats" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-chart-bar text-xs" /><span class="tab-label">Статистика</span></span></Tab>
            <Tab v-if="staff.isAdmin.value" value="manage" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-users text-xs" /><span class="tab-label">Управление</span></span></Tab>
            <Tab v-if="staff.isAdmin.value" value="security" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-shield text-xs" /><span class="tab-label">Безопасность</span><Badge v-if="logins.unseenCount.value" :value="logins.unseenCount.value > 99 ? '99+' : String(logins.unseenCount.value)" severity="danger" /></span></Tab>
            <Tab value="admin" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-cog text-xs" /><span class="tab-label">Модерация</span><Badge v-if="reports.pendingCount.value" :value="reports.pendingCount.value > 99 ? '99+' : String(reports.pendingCount.value)" severity="danger" /></span></Tab>
            <Tab value="business" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-briefcase text-xs" /><span class="tab-label">Бизнес</span><Badge v-if="businessQueue.pendingCount.value" :value="businessQueue.pendingCount.value > 99 ? '99+' : String(businessQueue.pendingCount.value)" severity="warn" /></span></Tab>
            <Tab value="refs" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-book text-xs" /><span class="tab-label">Справочники</span></span></Tab>
            <Tab value="seo" class="!text-[13px] !font-bold"><span class="flex items-center gap-1.5"><i class="pi pi-globe text-xs" /><span class="tab-label">SEO</span></span></Tab>
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
            <TabPanel v-if="staff.isAdmin.value" value="manage">
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
            <TabPanel v-if="staff.isAdmin.value" value="security">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminLoginAttempts :attempts="logins" />
                <AdminImpersonationLogs :logs="impLogs" />
              </div>
            </TabPanel>
            <TabPanel value="admin">
              <SettingsAdminTab :admin="admin" :reports="reports" :imp="imp" />
            </TabPanel>
            <TabPanel value="business">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminBusinessManager :queue="businessQueue" />
              </div>
            </TabPanel>
            <TabPanel value="refs">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminReferencesManager :mgr="refs" />
              </div>
            </TabPanel>
            <TabPanel value="seo">
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AdminSeoManager :mgr="seo" />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
        </template>
      </div>
      <Dialog :visible="!access.unlocked.value && !access.checking.value" modal :closable="false" :draggable="false" header="Панель модерации закрыта" :style="{ width: '400px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }">
        <div class="flex items-center gap-3">
          <span class="w-11 h-11 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 grid place-items-center shrink-0"><i class="pi pi-envelope" /></span>
          <p class="text-sm text-stone-600 dark:text-zinc-300">{{ access.step.value === 'code' ? 'Код отправлен на почту — введи 6 цифр. Действует 10 минут.' : 'Введи свою почту — пришлём туда одноразовый код.' }}</p>
        </div>
        <template v-if="access.step.value === 'email'">
          <label class="mt-4 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Твоя почта</label>
          <InputText v-model="access.email.value" type="email" inputmode="email" fluid placeholder="admin@example.com" class="mt-1 !rounded-2xl" @keyup.enter="access.requestCode()" />
        </template>
        <template v-else>
          <div class="mt-4 text-xs text-stone-500 dark:text-zinc-400">Код для <b class="dark:text-zinc-200">{{ access.email.value }}</b> · истекает через {{ access.codeTtlLabel.value }}</div>
          <div class="mt-2 flex justify-center">
            <InputOtp v-model="access.code.value" :length="6" integerOnly />
          </div>
          <div class="mt-2 flex gap-2 justify-center flex-wrap">
            <Button
              :label="access.cooldownLeft.value > 0 ? `Отправить заново (${access.cooldownLeft.value}с)` : 'Отправить заново'"
              link
              size="small"
              :disabled="access.cooldownLeft.value > 0 || access.acting.value"
              class="!text-xs"
              @click="access.requestCode()"
            />
            <Button label="Другая почта" link size="small" class="!text-xs" @click="access.backToEmail()" />
          </div>
        </template>
        <Message v-if="access.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ access.error.value }}</Message>
        <template #footer>
          <Button
            v-if="access.step.value === 'email'"
            label="Отправить код"
            icon="pi pi-send"
            rounded
            :loading="access.acting.value"
            :disabled="!access.email.value.trim()"
            class="w-full !bg-stone-900 dark:!bg-white dark:!text-stone-900 !text-white !font-bold !border-0"
            @click="access.requestCode()"
          />
          <Button
            v-else
            label="Открыть панель"
            icon="pi pi-lock-open"
            rounded
            :loading="access.acting.value"
            :disabled="access.code.value.trim().length !== 6"
            class="w-full !bg-stone-900 dark:!bg-white dark:!text-stone-900 !text-white !font-bold !border-0"
            @click="access.verify()"
          />
          <Button label="Мой профиль" link size="small" class="w-full !text-xs !mt-1" @click="router.visit('/profile')" />
        </template>
      </Dialog>
      <AdminImpersonateDialog :imp="imp" />
      <Dialog :visible="!!mon.pendingSelfRole.value" @update:visible="(v:boolean)=>{ if(!v) mon.cancelSelfRoleChange() }" modal header="Снять с себя права?" :style="{ width: '400px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600 dark:text-zinc-300">Сменить свою роль с <b>admin</b> на <b>{{ mon.pendingSelfRole.value?.role }}</b>? Ты потеряешь доступ к панели модерации.</p>
        <template #footer>
          <Button label="Отмена" text @click="mon.cancelSelfRoleChange()" />
          <Button label="Снять права" severity="danger" :loading="mon.actingId.value !== null" @click="mon.confirmSelfRoleChange()" />
        </template>
      </Dialog>
      <Dialog :visible="!!mon.pendingOrganizationRole.value" @update:visible="(v:boolean)=>{ if(!v) mon.cancelOrganizationRoleChange() }" modal header="Выдать роль «организация»?" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }">
        <Message severity="warn" :closable="false" class="!rounded-2xl !text-xs">Данный аккаунт персональный и не связан с предпринимательской деятельностью.</Message>
        <p class="mt-3 text-sm text-stone-600 dark:text-zinc-300">Выдать <b>{{ mon.pendingOrganizationRole.value?.user?.name }}</b> ({{ mon.pendingOrganizationRole.value?.user?.email }}) роль «организация»? Вместе с ролью автоматически включится тариф <b>business</b> — как у всех, кто зашёл в кабинет компании.</p>
        <template #footer>
          <Button label="Отмена" text @click="mon.cancelOrganizationRoleChange()" />
          <Button label="Выдать организацию" severity="warn" :loading="mon.actingId.value !== null" @click="mon.confirmOrganizationRoleChange()" />
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
</template>
