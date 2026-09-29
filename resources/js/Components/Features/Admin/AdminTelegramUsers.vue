<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

defineProps<{ tg: any }>()

/**
 * Короткая дата привязки/визита.
 *
 * @param dt ISO-дата или null
 * @returns локализованная строка или заглушка
 */
function fmt(dt: string | null): string {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dt
  }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Пользователи из Telegram</div>
        <Tag :value="`всего: ${tg.total.value}`" severity="info" class="!text-[9px]" />
        <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="tg.load()" />
      </div>
      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Кто пришёл из Telegram Mini App: никнеймы и TG-id. Только чтение.</p>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="tg.query.value" @update:modelValue="(v:string|undefined)=>tg.setQuery(v ?? '')" placeholder="Имя, email, @username или TG-id..." fluid size="small" rounded />
      </IconField>
      <div v-if="tg.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!tg.items.value.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">TG-пользователей пока нет</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="u in tg.items.value" :key="u.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="relative shrink-0">
              <Avatar :image="u.telegram_photo_url || u.avatar_url" shape="circle" class="!w-10 !h-10 [&_img]:object-cover" />
              <span v-if="u.is_online" class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" title="Онлайн" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold truncate dark:text-white">{{ u.name || 'Без имени' }}</div>
              <div class="text-[11px] truncate" :class="u.telegram_username ? 'text-sky-600 dark:text-sky-300 font-semibold' : 'text-stone-400'">
                {{ u.telegram_username ? `@${u.telegram_username}` : 'без username' }}
                <span class="font-normal text-stone-400">· TG-id {{ u.telegram_id || '—' }}</span>
              </div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">id {{ u.id }} · {{ u.email }} · был(а) {{ fmt(u.last_seen_at) }}</div>
            </div>
            <a v-if="u.telegram_username" :href="`https://t.me/${u.telegram_username}`" target="_blank" rel="noopener" class="shrink-0 w-8 h-8 grid place-items-center rounded-full hover:bg-sky-50 dark:hover:bg-sky-500/10 text-sky-600 dark:text-sky-300" title="Открыть в Telegram" aria-label="Открыть в Telegram">
              <i class="pi pi-send text-sm" />
            </a>
          </div>
        </div>
      </div>
      <Paginator v-if="tg.meta.value.last_page > 1" :rows="tg.meta.value.per_page" :totalRecords="tg.meta.value.total" :first="(tg.page.value - 1) * tg.meta.value.per_page" @page="(e:any)=>tg.setPage(e.page + 1)" class="!bg-transparent !border-0 !px-0" />
      <Message v-if="tg.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ tg.error.value }}</Message>
    </template>
  </Card>
</template>
