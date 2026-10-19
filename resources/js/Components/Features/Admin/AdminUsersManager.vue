<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useProfileUrl } from '@/composables/useProfileUrl'
import OrgBadge from '@/Components/Features/Chat/OrgBadge.vue'
import AdminCreateUserDialog from '@/Components/Features/Admin/AdminCreateUserDialog.vue'

const { selectPt } = useDropdownMenuStyle()
const { userProfileUrl } = useProfileUrl()

const props = defineProps<{ list: any[]; meta: any; page: number; query: string; filter: string; sort: string; limit: number; loading: boolean; actingId: number | null; admin: any; authUserId?: number | null }>()
const emit = defineEmits<{
  (e: 'update:query', v: string): void
  (e: 'filter', v: string): void
  (e: 'sort', v: string): void
  (e: 'limit', v: number): void
  (e: 'page', v: number): void
  (e: 'plan', u: any, v: string): void
  (e: 'role', u: any, v: string): void
  (e: 'impersonate', u: any): void
  (e: 'ban', u: any): void
  (e: 'unban', u: any): void
  (e: 'created'): void
}>()

const filterOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Онлайн', value: 'online' },
  { label: 'Новые 7д', value: 'new' },
  { label: 'Скрытые', value: 'hidden' },
  { label: 'Модераторы', value: 'admins' },
  { label: 'Организации', value: 'organizations' },
]
const sortOptions = [
  { label: 'Сначала активные', value: 'last_seen' },
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' },
  { label: 'По имени', value: 'name' },
]
const perPageOptions = [
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]
const planOptions = [
  { label: 'free', value: 'free' },
  { label: 'pro', value: 'pro' },
  { label: 'premium (стафф)', value: 'premium' },
  { label: 'business (организации)', value: 'business' },
]
const roleOptions = [
  { label: 'user', value: 'user' },
  { label: 'организация', value: 'organization' },
  { label: 'moderator', value: 'moderator' },
  { label: 'admin', value: 'admin' },
]

/**
 * Подпись «Показано X–Y из Z» в стиле WP-таблиц (`tablenav`).
 *
 * @returns Строка диапазона текущей страницы или «0» при пустом списке.
 */
const rangeLabel = computed(() => {
  const total = Number(props.meta?.total ?? 0)

  if (!total) return '0'

  const perPage = Number(props.meta?.per_page ?? props.limit ?? 20)
  const from = (props.page - 1) * perPage + 1
  const to = Math.min(total, props.page * perPage)

  return `Показано ${from}–${to} из ${total}`
})

/**
 * Подпись действующего тарифа под селектом плана.
 *
 * Показывает effective-план (по нему считаются лимиты), а не сырое
 * поле: тариф с прошедшим сроком действует как free.
 * Стафф всегда effective=premium (см. User::effectivePlan).
 *
 * @param u строка пользователя из списка мониторинга
 * @returns подпись вида «Действует: Premium до 12.10.2026» или «Free»
 */
function planCaption(u: any): string {
  const effective = String(u?.effective_plan ?? u?.plan ?? 'free')
  if (effective !== 'pro' && effective !== 'premium' && effective !== 'business') return 'Действует: Free'
  const label = effective === 'business' ? 'Business' : effective === 'premium' ? 'Premium' : 'Pro'
  if (!u?.plan_expires_at) return `Действует: ${label} · без срока`
  try {
    const date = new Date(u.plan_expires_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `Действует: ${label} до ${date}`
  } catch {
    return `Действует: ${label}`
  }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-bold text-stone-400 dark:text-zinc-500">Всего: {{ meta.total }}</span>
        <Button label="Тестовый" icon="pi pi-user-plus" size="small" rounded outlined severity="info" class="ml-auto !text-xs !py-1" title="Создать тестовый аккаунт с придуманными логином и паролем" @click="admin.openCreate()" />
      </div>
      <AdminCreateUserDialog :admin="admin" :onCreated="() => emit('created')" />
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="query" @update:modelValue="(v:string|undefined)=>emit('update:query', v ?? '')" placeholder="Имя или email..." fluid size="small" rounded />
      </IconField>
      <div class="mt-2.5 flex gap-1.5 flex-wrap items-center">
        <SelectButton :modelValue="filter" @update:modelValue="(v:string)=>emit('filter', v)" :options="filterOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="flex-wrap max-w-full admin-filter-pills" />
        <span class="ml-auto flex items-center gap-1.5">
          <Select :modelValue="sort" @update:modelValue="(v:string)=>emit('sort', v)" :options="sortOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" title="Сортировка" />
          <Select :modelValue="limit" @update:modelValue="(v:number)=>emit('limit', v)" :options="perPageOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" :pt="selectPt" title="Строк на странице" />
        </span>
      </div>
      <div class="mt-2.5 flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-semibold text-stone-400 dark:text-zinc-500">{{ rangeLabel }}</span>
        <Paginator v-if="meta.last_page > 1" :rows="meta.per_page" :totalRecords="meta.total" :first="(page - 1) * meta.per_page" @page="(e:any)=>emit('page', e.page + 1)" class="ml-auto !bg-transparent !border-0 !p-0" />
      </div>
      <div v-if="loading" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!list.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Ничего не найдено</div>
      <ul v-else class="admin-list-scroll mt-1 divide-y divide-stone-100 border-t border-stone-100 pr-1 dark:divide-zinc-800 dark:border-zinc-800">
        <li v-for="u in list" :key="u.id" class="py-2">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="relative shrink-0" :title="u.is_online ? 'онлайн' : 'офлайн'">
              <Avatar :image="avatarSrcFor(u)" shape="circle" class="!w-8 !h-8 [&_img]:object-cover" />
              <span v-if="u.is_online" class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-1.5">
                <Link :href="userProfileUrl(u)" class="min-w-0 truncate text-[13px] font-semibold text-stone-900 underline-offset-2 hover:text-violet-600 hover:underline dark:text-white dark:hover:text-violet-400">{{ u.name }}</Link>
                <OrgBadge :is-organization="u.is_organization" />
                <Tag v-if="authUserId && Number(u.id) === Number(authUserId)" value="это вы" severity="warn" class="!text-[9px] shrink-0" />
                <Tag v-if="u.role === 'organization' || u.is_organization" value="орг" severity="info" class="!text-[9px] shrink-0" />
                <Tag v-if="u.is_hidden_from_search" value="скрыт" severity="contrast" class="!text-[9px] shrink-0" />
                <Tag v-if="u.banned_at" value="бан" severity="danger" class="!text-[9px] shrink-0" />
              </div>
              <div class="truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ u.email }} · пинов {{ u.pins_count ?? 0 }} · {{ planCaption(u) }}<span v-if="u.is_business"> · {{ u.business?.legal_form === 'ip' ? 'ИП' : u.business?.legal_form === 'ooo' ? 'ООО' : u.business?.legal_form ?? 'бизнес' }}{{ u.business?.unp ? ` · УНП ${u.business.unp}` : '' }}</span></div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button @click="admin.toggleUser(u)" :loading="admin.togglingId.value === u.id" :icon="u.is_hidden_from_search ? 'pi pi-eye' : 'pi pi-eye-slash'" size="small" rounded outlined :severity="u.is_hidden_from_search ? 'success' : 'secondary'" class="!h-8 !w-8 !p-0" :title="u.is_hidden_from_search ? 'Показать в поиске' : 'Скрыть из поиска'" />
              <Button v-if="!u.banned_at" @click="emit('ban', u)" :disabled="!!u.is_admin" icon="pi pi-ban" size="small" rounded outlined severity="danger" class="!h-8 !w-8 !p-0" title="Забанить" />
              <Button v-else @click="emit('unban', u)" icon="pi pi-check" size="small" rounded outlined severity="success" class="!h-8 !w-8 !p-0" title="Разбанить" />
              <Button @click="emit('impersonate', u)" :disabled="!!u.is_admin" icon="pi pi-sign-in" size="small" rounded outlined severity="warn" class="!h-8 !w-8 !p-0" title="Войти в аккаунт" />
              <Button @click="admin.askDelete(u)" :disabled="u.is_admin" :loading="admin.deletingId.value === u.id" icon="pi pi-trash" size="small" rounded outlined severity="danger" class="!h-8 !w-8 !p-0" title="Удалить аккаунт" />
            </div>
          </div>
          <div class="mt-1.5 flex gap-1.5">
            <Select :modelValue="u.plan" @change="(e:any)=>emit('plan', u, e.value)" :options="planOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" :disabled="actingId === u.id" checkmark class="min-w-0 flex-1 sm:max-w-44" title="Тариф" />
            <Select :modelValue="u.role || 'user'" @change="(e:any)=>emit('role', u, e.value)" :options="roleOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" :disabled="actingId === u.id || (!!u.is_admin && !(authUserId && Number(u.id) === Number(authUserId)))" :title="authUserId && Number(u.id) === Number(authUserId) ? 'Сменить свою роль' : 'Роль'" checkmark class="min-w-0 flex-1 sm:max-w-36" />
          </div>
        </li>
      </ul>
      <Paginator v-if="!loading && meta.last_page > 1" :rows="meta.per_page" :totalRecords="meta.total" :first="(page - 1) * meta.per_page" @page="(e:any)=>emit('page', e.page + 1)" class="!bg-transparent !border-0 !px-0" />
    </template>
  </Card>
</template>
