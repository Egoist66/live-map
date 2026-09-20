<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

defineProps<{ attempts: any }>()

const filterOptions = [
  { label: 'Неудачные', value: 'failed' },
  { label: 'Успешные', value: 'success' },
  { label: 'Все', value: 'all' },
]

/** Порог «рецидивиста»: столько фейлов с IP за 24ч подсвечиваем. */
const REPEAT_OFFENDER_IP_FAILS = 10

function fmt(dt: string | null) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return dt }
}

function flag(cc: string | null | undefined) {
  if (!cc || cc.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(...cc.toUpperCase().split('').map((c) => base + c.charCodeAt(0) - 65))
}

function shortUa(ua: string | null | undefined) {
  if (!ua) return '—'
  if (/Mobile|Android|iPhone/i.test(ua)) return '📱 ' + ua.split(')').pop()?.trim().slice(0, 60)
  if (/Windows/i.test(ua)) return '🖥 Windows · ' + (/Chrome\/[\d.]+/.exec(ua)?.[0] || /Firefox\/[\d.]+/.exec(ua)?.[0] || 'браузер')
  if (/Macintosh/i.test(ua)) return '🖥 Mac · ' + (/Chrome\/[\d.]+/.exec(ua)?.[0] || /Safari\/[\d.]+/.exec(ua)?.[0] || 'браузер')
  if (/Linux/i.test(ua)) return '🖥 Linux'
  if (/bot|crawl|spider|python|curl/i.test(ua)) return '🤖 бот: ' + ua.slice(0, 60)
  return ua.slice(0, 80)
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Неудачные входы</div>
        <Tag :value="`за 24ч: ${attempts.stats.value.failed_today}`" severity="danger" class="!text-[9px]" />
        <Tag :value="`забанено: ${attempts.stats.value.banned_total}`" severity="contrast" class="!text-[9px]" />
        <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="attempts.load()" />
      </div>
      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">3 неверных пароля — заморозка на час, 4-й неверный — вечный бан. Клик по IP или email — фильтр по нарушителю. Тег «перебор» — с одного IP долбят разные аккаунты.</p>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="attempts.query.value" @update:modelValue="(v:string|undefined)=>attempts.setQuery(v ?? '')" placeholder="Email, IP или страна..." fluid size="small" rounded />
      </IconField>
      <SelectButton :modelValue="attempts.filter.value" @update:modelValue="(v:string)=>attempts.setFilter(v as any)" :options="filterOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="mt-2.5 flex-wrap max-w-full" />
      <div v-if="attempts.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!attempts.items.value.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Попыток пока нет — всё чисто</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="a in attempts.items.value" :key="a.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3" :class="!a.successful && (a.ip_fails_24h ?? 0) >= REPEAT_OFFENDER_IP_FAILS ? '!border-red-300 dark:!border-red-800' : ''">
          <div class="flex items-center gap-2 min-w-0">
            <i :class="a.successful ? 'pi pi-check-circle text-emerald-500' : 'pi pi-times-circle text-red-500'" class="text-sm shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold truncate dark:text-white">{{ a.user?.name || a.email }} <span class="font-normal text-stone-400">· {{ fmt(a.created_at) }}</span></div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ a.email }} · {{ a.ip || 'IP скрыт' }} · {{ flag(a.country_code) }} {{ a.country || 'страна?' }}{{ a.city ? `, ${a.city}` : '' }}</div>
            </div>
            <Tag v-if="a.successful" value="успех" severity="success" class="!text-[9px] shrink-0" />
            <Tag v-else value="фейл" severity="danger" class="!text-[9px] shrink-0" />
          </div>
          <div v-if="!a.successful" class="mt-2 flex gap-1.5 flex-wrap items-center">
            <Tag v-if="(a.ip_fails_24h ?? 0) >= REPEAT_OFFENDER_IP_FAILS" value="рецидивист" severity="danger" class="!text-[9px]" />
            <Tag :value="`IP: ${a.ip_fails_24h ?? 0} попыток / 24ч`" :severity="(a.ip_fails_24h ?? 0) >= 5 ? 'danger' : 'contrast'" class="!text-[9px]" />
            <Tag v-if="(a.ip_emails_24h ?? 0) > 1" :value="`перебор: ${a.ip_emails_24h} email`" severity="warn" class="!text-[9px]" title="С одного IP долбят разные аккаунты — признак credential stuffing" />
            <Tag :value="`email: ${a.email_fails_24h ?? 0} попыток / 24ч`" severity="contrast" class="!text-[9px]" />
          </div>
          <div class="mt-1.5 flex gap-1.5 flex-wrap items-center">
            <Button v-if="a.ip" @click="attempts.setQuery(a.ip)" :label="a.ip" link size="small" class="!text-[11px] !px-0" title="Показать все попытки с этого IP" />
            <Button @click="attempts.setQuery(a.email)" :label="a.email" link size="small" class="!text-[11px] !px-0" title="Показать все попытки по этому email" />
          </div>
          <div class="mt-1 text-[11px] text-stone-400 truncate" :title="a.user_agent">{{ shortUa(a.user_agent) }}</div>
          <details class="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">
            <summary class="cursor-pointer select-none text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200">Полный user-agent и сырые данные</summary>
            <div class="mt-1 break-all rounded-xl bg-stone-100 dark:bg-zinc-800 px-2.5 py-2">{{ a.user_agent || '—' }}</div>
            <div class="mt-1 truncate">IP {{ a.ip || 'скрыт' }} · {{ a.country || '?' }} ({{ a.country_code || '?' }}) · {{ a.city || 'город?' }}</div>
          </details>
          <div v-if="a.user" class="mt-2 flex gap-1.5 flex-wrap items-center">
            <Tag v-if="a.user.banned_at" value="забанен" severity="danger" class="!text-[9px]" />
            <span v-if="a.user.banned_reason" class="text-[11px] text-stone-400 truncate">{{ a.user.banned_reason }}</span>
            <span class="flex-1" />
            <Button v-if="!a.user.banned_at" @click="attempts.ban(a.user)" :loading="attempts.actingId.value === a.user.id" label="Забанить" size="small" rounded outlined severity="danger" class="!text-xs !py-1" />
            <Button v-else @click="attempts.unban(a.user)" :loading="attempts.actingId.value === a.user.id" label="Разбанить" size="small" rounded outlined severity="success" class="!text-xs !py-1" />
          </div>
          <div v-else class="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">Аккаунта с таким email нет — забанить некого, IP уже в кулдауне.</div>
        </div>
      </div>
      <Paginator v-if="attempts.meta.value.last_page > 1" :rows="attempts.meta.value.per_page" :totalRecords="attempts.meta.value.total" :first="(attempts.page.value - 1) * attempts.meta.value.per_page" @page="(e:any)=>attempts.setPage(e.page + 1)" class="!bg-transparent !border-0 !px-0" />
      <Message v-if="attempts.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ attempts.error.value }}</Message>
    </template>
  </Card>
</template>
