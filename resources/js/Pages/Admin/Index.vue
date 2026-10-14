<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import Toast from 'primevue/toast'
import Message from 'primevue/message'
import InputText from 'primevue/inputtext'
import InputOtp from 'primevue/inputotp'
import { useAdminMonitoring } from '@/composables/useAdminMonitoring'
import { useAdminUsers } from '@/composables/useAdminUsers'
import { useAdminReports } from '@/composables/useAdminReports'
import AdminStatsCards from '@/Components/Features/Admin/AdminStatsCards.vue'
import AdminActivityChart from '@/Components/Features/Admin/AdminActivityChart.vue'
import AdminOnlineList from '@/Components/Features/Admin/AdminOnlineList.vue'
import AdminImpersonateDialog from '@/Components/Features/Admin/AdminImpersonateDialog.vue'
import AdminSidebar from '@/Components/Features/Admin/AdminSidebar.vue'
import AdminTopbar from '@/Components/Features/Admin/AdminTopbar.vue'
import { useAdminSections } from '@/composables/useAdminSections'
import { useAdminReference } from '@/composables/useAdminReference'
import { useAdminSeo } from '@/composables/useAdminSeo'
import { useAdminAppUpdates } from '@/composables/useAdminAppUpdates'
import { useAdminImpersonate } from '@/composables/useAdminImpersonate'
import { useAdminImpersonationLogs } from '@/composables/useAdminImpersonationLogs'
import { useAdminLoginAttempts } from '@/composables/useAdminLoginAttempts'
import { useAppMaintenance } from '@/composables/useAppMaintenance'
import { useAdminAccess } from '@/composables/useAdminAccess'
import { useAdminTelegramUsers } from '@/composables/useAdminTelegramUsers'
import { useAdminBotBroadcasts } from '@/composables/useAdminBotBroadcasts'
import { useAdminBusiness } from '@/composables/useAdminBusiness'
import { closePopupOrVisit, useAdminTabs } from '@/composables/useAdminTabs'
import { useAdminLayout } from '@/composables/useAdminLayout'
import { useStaffRole } from '@/composables/useStaffRole'
import { computed, onMounted, watch } from 'vue'

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
const tgUsers = useAdminTelegramUsers()
const botBroadcasts = useAdminBotBroadcasts()

/**
 * Тяжёлые табы — ленивыми чанками: упавший чанк гасит только свою секцию
 * (скелет → плашка с «Повторить»), а не всю консоль белым экраном.
 */
const {
  users: AdminUsersSection,
  business: AdminBusinessSection,
  updates: AdminUpdatesSection,
  impersonateLogs: AdminImpersonateLogsSection,
  loginAttempts: AdminLoginAttemptsSection,
  maintenance: AdminMaintenanceSection,
  modules: AdminModulesSection,
  payments: AdminPaymentsSection,
  ai: AdminAiSection,
  references: AdminReferencesSection,
  seo: AdminSeoSection,
  telegramUsers: AdminTelegramUsersSection,
  botBroadcasts: AdminBotBroadcastsSection,
  adminTab: SettingsAdminTabSection,
} = useAdminSections()

/**
 * Счётчики для бейджей бокового меню (жалобы, бизнес, алерты).
 */
const layoutBadges = computed(() => ({
  reports: reports.pendingCount.value ?? 0,
  business: businessQueue.pendingCount.value ?? 0,
  security: logins.unseenCount.value ?? 0,
}))

const layout = useAdminLayout(layoutBadges)

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
  void tgUsers.load()
  if (!staff.isAdmin.value) return
  void botBroadcasts.load()
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

/**
 * Подтвердить удаление пользователя: строка исчезает из таблицы сразу.
 *
 * Ошибка уже лежит в admin.error и показывается в диалоге,
 * поэтому здесь её глушим — диалог остаётся открытым.
 */
async function confirmUserDelete(): Promise<void> {
  try {
    await admin.doDelete((id: number) => mon.dropUser(id))
  } catch {
    // No-op: текст ошибки виден в диалоге.
  }
}

/**
 * Уйти на витрину (кнопка «На сайт» в админ-баре).
 *
 * Вкладка-попап (открыта через «Панель модерации») закрывается
 * с возвратом в исходную вкладку, прямой заход — навигация.
 */
function goHome(): void {
  closePopupOrVisit('/')
}

/**
 * Открыть свой профиль из админ-бара.
 *
 * Вкладка-попап закрывается с возвратом в исходную вкладку,
 * где открывали панель, — профиль там уже открыт.
 */
function goProfile(): void {
  closePopupOrVisit('/profile')
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
  <Head title="Консоль — ULove Admin" />
  <Toast />
  <!-- Отступ под fixed-шапку: ровно её высота (h-14 + safe-area).
       Без него контент прячется под AdminTopbar. -->
  <div class="min-h-screen bg-[#f0f0f5] pt-[calc(3.5rem+var(--sat,0px))] text-stone-900 dark:bg-[#0F121F] dark:text-zinc-100">
    <AdminTopbar
      :refresh-loading="mon.loadingOverview.value"
      @menu="layout.openDrawer()"
      @collapse="layout.toggleCollapse()"
      @home="goHome()"
      @refresh="mon.refreshAll()"
      @profile="goProfile()"
      @lock="access.lock()"
    />

    <template v-if="!access.unlocked.value">
      <main class="mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-[560px] place-items-center px-4 py-10">
        <Card class="!rounded-3xl !border-stone-200 !bg-white !shadow-soft dark:!border-zinc-800 dark:!bg-zinc-900" :pt="{ body: { class: '!p-8 sm:!p-10' }, content: { class: '!p-0 text-center' } }">
          <template #content>
            <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#1d2327] text-white"><i class="pi pi-lock text-xl" /></div>
            <h1 class="mt-4 text-lg font-black dark:text-white">{{ access.checking.value ? 'Проверяем доступ…' : 'Консоль закрыта' }}</h1>
            <p v-if="!access.checking.value" class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Введи код из почты, чтобы открыть админку.</p>
          </template>
        </Card>
      </main>
    </template>

    <template v-else>
      <div class="w-full">
        <div
          class="fixed bottom-0 left-0 top-14 z-30 hidden w-[264px] transition-[width] duration-200 lg:block"
          :class="layout.state.collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'"
        >
          <AdminSidebar
            :groups="layout.navGroups.value"
            :active-id="tab"
            :collapsed="layout.state.collapsed"
            show-collapse
            @select="layout.selectTab($event)"
            @toggle="layout.toggleCollapse()"
          />
        </div>

        <main class="min-w-0 bg-[#f0f0f5] pb-10 transition-[margin] duration-200 dark:bg-[#0F121F]" :class="layout.state.collapsed ? 'lg:ml-[76px]' : 'lg:ml-[264px]'" aria-label="Содержимое админки">
          <div class="mx-auto w-full max-w-[1280px] px-3 py-4 sm:px-5 sm:py-5">
            <div class="mb-4 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h1 class="wp-heading-inline text-xl font-black tracking-tight sm:text-2xl dark:text-white">
                {{ layout.pageHeading.value.title }}
              </h1>
              <p class="pb-0.5 text-[13px] text-stone-500 sm:pb-1 dark:text-zinc-400">
                {{ layout.pageHeading.value.hint }}
              </p>
              <span class="flex-1" />
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <i class="pi" :class="staff.isAdmin.value ? 'pi-shield' : 'pi-eye'" aria-hidden="true" />
                {{ staff.isAdmin.value ? 'Администратор' : 'Модератор' }}
              </span>
            </div>

            <section v-if="tab === 'stats'" aria-label="Консоль">
              <AdminStatsCards :overview="mon.overview.value" :pct="mon.onlinePct.value" :loading="mon.loadingOverview.value" />
              <div class="mt-4 grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <AdminActivityChart :points="mon.points.value" :max="mon.maxChart.value" :days="mon.chartDays.value" :loading="mon.loadingChart.value" :summary="mon.summary.value" :exporting="mon.exporting.value" @days="(v:number)=>mon.chartDays.value=v" @export="mon.exportExcel()" />
                <AdminOnlineList
                  :list="mon.online.value" :meta="mon.onlineMeta.value" :page="mon.onlinePage.value" :limit="mon.onlineLimit.value" :query="mon.onlineQuery.value" :loading="mon.loadingOnline.value"
                  @update:query="(v:string)=>mon.onlineQuery.value=v" @limit="(v:number)=>mon.setOnlineLimit(v as any)" @page="mon.setOnlinePage"
                />
              </div>
            </section>

            <section v-else-if="tab === 'manage' && staff.isAdmin.value" aria-label="Пользователи">
              <div class="min-w-0 max-w-[960px]">
                <AdminUsersSection
                  :list="mon.users.value" :meta="mon.usersMeta.value" :page="mon.usersPage.value" :query="mon.usersQuery.value" :filter="mon.usersFilter.value" :sort="mon.usersSort.value" :limit="mon.usersLimit.value" :loading="mon.loadingUsers.value" :acting-id="mon.actingId.value" :admin="admin" :auth-user-id="mon.authUserId.value"
                  @update:query="(v:string)=>mon.usersQuery.value=v" @filter="(v:string)=>mon.setUsersFilter(v as any)" @sort="(v:string)=>mon.usersSort.value=v as any" @limit="(v:number)=>mon.usersLimit.value=v" @page="mon.setUsersPage"
                  @plan="mon.setPlan" @role="mon.requestRoleChange" @impersonate="imp.ask" @ban="(u:any)=>logins.ban(u)" @unban="(u:any)=>logins.unban(u)" @created="mon.loadUsers()"
                />
              </div>
            </section>

            <section v-else-if="tab === 'security' && staff.isAdmin.value" aria-label="Безопасность">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <div class="min-w-0 xl:col-span-2">
                  <AdminMaintenanceSection :mgr="maintenance" />
                </div>
                <AdminLoginAttemptsSection :attempts="logins" />
                <AdminImpersonateLogsSection :logs="impLogs" />
              </div>
            </section>

            <section v-else-if="tab === 'admin'" aria-label="Модерация">
              <SettingsAdminTabSection :admin="admin" :reports="reports" :imp="imp" />
            </section>

            <section v-else-if="tab === 'business'" aria-label="Бизнес">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminBusinessSection :queue="businessQueue" />
              </div>
            </section>

            <section v-else-if="tab === 'modules' && staff.isAdmin.value" aria-label="Модули">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminModulesSection />
                <AdminUpdatesSection :mgr="appUpdates" />
              </div>
            </section>

            <section v-else-if="tab === 'payments' && staff.isAdmin.value" aria-label="Тарифы">
              <div class="min-w-0 max-w-[960px]">
                <AdminPaymentsSection />
              </div>
            </section>

            <section v-else-if="tab === 'ai' && staff.isAdmin.value" aria-label="ИИ">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminAiSection />
              </div>
            </section>

            <section v-else-if="tab === 'refs'" aria-label="Справочники">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminReferencesSection :mgr="refs" />
              </div>
            </section>

            <section v-else-if="tab === 'seo'" aria-label="SEO">
              <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminSeoSection :mgr="seo" />
              </div>
            </section>

            <section v-else-if="tab === 'telegram'" aria-label="Telegram">
              <div class="min-w-0 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <AdminTelegramUsersSection :tg="tgUsers" />
                <AdminBotBroadcastsSection v-if="staff.isAdmin.value" :bb="botBroadcasts" />
              </div>
            </section>

            <section v-else aria-label="Консоль">
              <AdminStatsCards :overview="mon.overview.value" :pct="mon.onlinePct.value" :loading="mon.loadingOverview.value" />
              <div class="mt-4 grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <AdminActivityChart :points="mon.points.value" :max="mon.maxChart.value" :days="mon.chartDays.value" :loading="mon.loadingChart.value" :summary="mon.summary.value" :exporting="mon.exporting.value" @days="(v:number)=>mon.chartDays.value=v" @export="mon.exportExcel()" />
                <AdminOnlineList
                  :list="mon.online.value" :meta="mon.onlineMeta.value" :page="mon.onlinePage.value" :limit="mon.onlineLimit.value" :query="mon.onlineQuery.value" :loading="mon.loadingOnline.value"
                  @update:query="(v:string)=>mon.onlineQuery.value=v" @limit="(v:number)=>mon.setOnlineLimit(v as any)" @page="mon.setOnlinePage"
                />
              </div>
            </section>
          </div>
        </main>
      </div>

      <Drawer
        :visible="layout.state.drawerOpen"
        position="left"
        :show-close-icon="false"
        :block-scroll="true"
        class="!w-[86vw] !max-w-[320px] !overflow-hidden !border-0 !rounded-r-[24px] !rounded-l-none"
        :pt="{
          root: { class: '!bg-[#1d2327] !text-[#eee] !border-0 !inset-y-0 !left-0 !mr-auto !ml-0 !h-dvh !max-h-dvh' },
          mask: { class: '!p-0 !m-0' },
          header: { class: '!p-0 !m-0 w-full !border-0 !bg-transparent' },
          title: { class: '!m-0 w-full max-w-full' },
          content: { class: '!p-0 !bg-transparent !overflow-hidden !flex !flex-col' },
        }"
        @update:visible="(v:boolean) => { v ? layout.openDrawer() : layout.closeDrawer() }"
      >
        <template #header>
          <div class="flex w-full items-center gap-2.5 border-b border-white/10 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2271b1] text-sm font-black text-white">U</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-black text-white">ULove · Консоль</span>
              <span class="block truncate text-[11px] text-[#a7aaad]">{{ staff.isAdmin.value ? 'Администратор' : 'Модератор' }}</span>
            </span>
            <Button icon="pi pi-times" rounded text aria-label="Закрыть меню" class="!h-9 !w-9 !p-0 shrink-0 !text-[#a7aaad] hover:!bg-[#2c3338] hover:!text-white" @click="layout.closeDrawer()" />
          </div>
        </template>
        <div class="flex min-h-0 flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AdminSidebar
            :groups="layout.navGroups.value"
            :active-id="tab"
            @select="layout.selectTab($event)"
          />
        </div>
      </Drawer>
    </template>

    <Dialog :visible="!access.unlocked.value && !access.checking.value" modal :closable="false" :draggable="false" header="Консоль закрыта" :style="{ width: '400px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }">
      <div class="flex items-center gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1d2327] text-white"><i class="pi pi-envelope" /></span>
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
        <div class="mt-2 flex flex-wrap justify-center gap-2">
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
          class="w-full !border-0 !bg-[#1d2327] !font-bold !text-white dark:!bg-white dark:!text-stone-900"
          @click="access.requestCode()"
        />
        <Button
          v-else
          label="Открыть консоль"
          icon="pi pi-lock-open"
          rounded
          :loading="access.acting.value"
          :disabled="access.code.value.trim().length !== 6"
          class="w-full !border-0 !bg-[#1d2327] !font-bold !text-white dark:!bg-white dark:!text-stone-900"
          @click="access.verify()"
        />
        <Button label="Мой профиль" link size="small" class="w-full !mt-1 !text-xs" @click="goProfile()" />
      </template>
    </Dialog>
    <AdminImpersonateDialog :imp="imp" />
    <Dialog :visible="!!mon.pendingSelfRole.value" modal header="Снять с себя права?" :style="{ width: '400px', maxWidth: '94vw' }" @update:visible="(v:boolean)=>{ if(!v) mon.cancelSelfRoleChange() }">
      <p class="text-sm text-stone-600 dark:text-zinc-300">Сменить свою роль с <b>admin</b> на <b>{{ mon.pendingSelfRole.value?.role }}</b>? Ты потеряешь доступ к панели модерации.</p>
      <template #footer>
        <Button label="Отмена" text @click="mon.cancelSelfRoleChange()" />
        <Button label="Снять права" severity="danger" :loading="mon.actingId.value !== null" @click="mon.confirmSelfRoleChange()" />
      </template>
    </Dialog>
    <Dialog :visible="!!mon.pendingOrganizationRole.value" modal header="Выдать роль «организация»?" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-zinc-900 dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-zinc-900' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-zinc-900' } }" @update:visible="(v:boolean)=>{ if(!v) mon.cancelOrganizationRoleChange() }">
      <Message severity="warn" :closable="false" class="!rounded-2xl !text-xs">Данный аккаунт персональный и не связан с предпринимательской деятельностью.</Message>
      <p class="mt-3 text-sm text-stone-600 dark:text-zinc-300">Выдать <b>{{ mon.pendingOrganizationRole.value?.user?.name }}</b> ({{ mon.pendingOrganizationRole.value?.user?.email }}) роль «организация»? Вместе с ролью автоматически включится тариф <b>business</b> — как у всех, кто зашёл в кабинет компании.</p>
      <template #footer>
        <Button label="Отмена" text @click="mon.cancelOrganizationRoleChange()" />
        <Button label="Выдать организацию" severity="warn" :loading="mon.actingId.value !== null" @click="mon.confirmOrganizationRoleChange()" />
      </template>
    </Dialog>
    <Dialog :visible="!!admin.confirmDelete.value" modal header="Удалить аккаунт?" :style="{ width: '400px', maxWidth: '94vw' }" @update:visible="(v:boolean)=>{ if(!v) admin.closeConfirm() }">
      <p class="text-sm text-stone-600 dark:text-zinc-300">Удалить <b>{{ admin.confirmDelete.value?.name }}</b> ({{ admin.confirmDelete.value?.email }})? Это нельзя отменить.</p>
      <Message v-if="admin.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ admin.error.value }}</Message>
      <template #footer>
        <Button label="Отмена" text @click="admin.closeConfirm()" />
        <Button label="Удалить" severity="danger" :loading="admin.deletingId.value !== null" @click="confirmUserDelete()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.wp-heading-inline {
  text-wrap: balance;
}
</style>
