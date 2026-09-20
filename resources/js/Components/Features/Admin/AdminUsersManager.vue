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
import { avatarSrcFor } from '@/composables/useAvatar'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

const { selectPt } = useDropdownMenuStyle()

defineProps<{ list: any[]; meta: any; page: number; query: string; filter: string; sort: string; limit: number; loading: boolean; actingId: number | null; admin: any; authUserId?: number | null }>()
const emit = defineEmits<{
  (e: 'update:query', v: string): void
  (e: 'filter', v: string): void
  (e: 'sort', v: string): void
  (e: 'page', v: number): void
  (e: 'plan', u: any, v: string): void
  (e: 'role', u: any, v: string): void
  (e: 'impersonate', u: any): void
  (e: 'ban', u: any): void
  (e: 'unban', u: any): void
}>()

const filterOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Онлайн', value: 'online' },
  { label: 'Новые 7д', value: 'new' },
  { label: 'Скрытые', value: 'hidden' },
  { label: 'Модераторы', value: 'admins' },
]
const sortOptions = [
  { label: 'Сначала активные', value: 'last_seen' },
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' },
  { label: 'По имени', value: 'name' },
]
const planOptions = [
  { label: 'free', value: 'free' },
  { label: 'pro', value: 'pro' },
  { label: 'business', value: 'business' },
]
const roleOptions = [
  { label: 'user', value: 'user' },
  { label: 'moderator', value: 'moderator' },
  { label: 'admin', value: 'admin' },
]

/**
 * Подпись действующего тарифа под селектом плана.
 *
 * Показывает effective-план (по нему считаются лимиты), а не сырое
 * поле: тариф с прошедшим сроком действует как free.
 *
 * @param u строка пользователя из списка мониторинга
 * @returns подпись вида «Действует: Pro до 12.10.2026» или «Free»
 */
function planCaption(u: any): string {
  const effective = String(u?.effective_plan ?? u?.plan ?? 'free')
  if (effective !== 'pro' && effective !== 'business') return 'Действует: Free'
  const label = effective === 'business' ? 'Business' : 'Pro'
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
      <div class="font-black dark:text-white">Пользователи <span class="text-xs font-bold text-stone-400 dark:text-zinc-500">· {{ meta.total }}</span></div>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="query" @update:modelValue="(v:string|undefined)=>emit('update:query', v ?? '')" placeholder="Имя или email..." fluid size="small" rounded />
      </IconField>
      <div class="mt-2.5 flex gap-1.5 flex-wrap items-center">
        <SelectButton :modelValue="filter" @update:modelValue="(v:string)=>emit('filter', v)" :options="filterOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="flex-wrap max-w-full" />
        <Select :modelValue="sort" @update:modelValue="(v:string)=>emit('sort', v)" :options="sortOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" class="ml-auto" />
      </div>
      <div v-if="loading" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!list.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Ничего не найдено</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="u in list" :key="u.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="relative shrink-0">
              <Avatar :image="avatarSrcFor(u)" shape="circle" class="!w-9 !h-9 [&_img]:object-cover" />
              <span v-if="u.is_online" class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold truncate dark:text-white">{{ u.name }}</div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ u.email }} · пинов {{ u.pins_count ?? 0 }}</div>
            </div>
            <Tag v-if="u.is_online" value="онлайн" severity="success" class="!text-[9px]" />
            <Tag v-else value="офлайн" severity="secondary" class="!text-[9px]" />
            <Tag v-if="authUserId && Number(u.id) === Number(authUserId)" value="это вы" severity="warn" class="!text-[9px]" />
            <Tag v-if="u.is_hidden_from_search" value="скрыт" severity="contrast" class="!text-[9px]" />
            <Tag v-if="u.banned_at" value="забанен" severity="danger" class="!text-[9px]" />
          </div>
          <div class="text-[11px] text-stone-400 dark:text-zinc-500">{{ planCaption(u) }}</div>
          <div class="mt-2.5 flex gap-1.5 flex-wrap items-center">
            <Select :modelValue="u.plan" @change="(e:any)=>emit('plan', u, e.value)" :options="planOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" :disabled="actingId === u.id" checkmark />
            <Select :modelValue="u.role || 'user'" @change="(e:any)=>emit('role', u, e.value)" :options="roleOptions" optionLabel="label" optionValue="value" size="small" appendTo="body" scrollHeight="16rem" :pt="selectPt" :disabled="actingId === u.id || (!!u.is_admin && !(authUserId && Number(u.id) === Number(authUserId)))" :title="authUserId && Number(u.id) === Number(authUserId) ? 'Сменить свою роль' : undefined" checkmark />
            <span class="flex-1" />
            <Button @click="admin.toggleUser(u)" :loading="admin.togglingId.value === u.id" :label="u.is_hidden_from_search ? 'Показать' : 'Скрыть'" size="small" rounded :outlined="!u.is_hidden_from_search" class="!text-xs !py-1" :severity="u.is_hidden_from_search ? 'success' : 'secondary'" />
            <Button v-if="!u.banned_at" @click="emit('ban', u)" :disabled="!!u.is_admin" icon="pi pi-ban" size="small" rounded outlined severity="danger" title="Забанить" />
            <Button v-else @click="emit('unban', u)" icon="pi pi-check" size="small" rounded outlined severity="success" title="Разбанить" />
            <Button @click="emit('impersonate', u)" :disabled="!!u.is_admin" icon="pi pi-sign-in" size="small" rounded outlined severity="warn" title="Войти в аккаунт" />
            <Button @click="admin.askDelete(u)" :disabled="u.is_admin" icon="pi pi-trash" size="small" rounded outlined severity="danger" />
          </div>
        </div>
      </div>
      <Paginator v-if="meta.last_page > 1" :rows="meta.per_page" :totalRecords="meta.total" :first="(page - 1) * meta.per_page" @page="(e:any)=>emit('page', e.page + 1)" class="!bg-transparent !border-0 !px-0" />
    </template>
  </Card>
</template>
