<script setup lang="ts">
import Card from 'primevue/card'
import ToggleSwitch from 'primevue/toggleswitch'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import { onMounted } from 'vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useRealtimeMode } from '@/composables/useRealtimeMode'

defineProps<{ admin: any; reports: any; imp?: any }>()

const realtime = useRealtimeMode()
onMounted(() => { realtime.init().catch(() => {}) })

const reportFilters = [
  { label: 'Новые', value: 'pending' },
  { label: 'Принятые', value: 'resolved' },
  { label: 'Отклонённые', value: 'dismissed' },
  { label: 'Все', value: 'all' },
]
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Админ</h3>
      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Жалобы, скрытие профилей и удаление аккаунтов.</p>
      <div class="mt-5 space-y-4 max-w-xl">
        <Card class="!border-amber-200 dark:!border-amber-950 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-900" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white">Запасной realtime (поллинг)</div>
                <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Временная мера, пока упираемся в лимит WS-соединений. Клиенты опрашивают сервер раз в 3 секунды: сообщения, «печатает...», заявки, мэтчи, лайки, активность пинов, «в сети» и бейджи. Выключи, когда поднимешь тариф — вернутся сокеты.</p>
              </div>
              <ToggleSwitch :modelValue="realtime.isPolling.value" @update:modelValue="(v:boolean)=>realtime.setMode(v ? 'polling' : 'socket').catch(()=>{})" :disabled="realtime.saving.value || realtime.loading.value" class="shrink-0" :pt="{ root: { class: '!shrink-0' } }" />
            </div>
            <div class="mt-2 flex items-center gap-2">
              <Tag :value="realtime.isPolling.value ? 'поллинг' : 'сокеты'" :severity="realtime.isPolling.value ? 'warn' : 'success'" class="!text-[10px]" />
              <span v-if="realtime.saving.value" class="text-xs text-stone-500 dark:text-zinc-400">переключаю…</span>
            </div>
            <Message v-if="realtime.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ realtime.error.value }}</Message>
          </template>
        </Card>
        <Card class="!border-red-200 dark:!border-red-950 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-900" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-2xl bg-red-600 text-white grid place-items-center shrink-0"><i class="pi pi-flag text-xs"></i></span>
              <div class="text-sm font-semibold dark:text-white">Жалобы</div>
              <Tag v-if="reports.pendingCount.value" :value="String(reports.pendingCount.value)" severity="danger" class="!text-[10px]" />
              <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="reports.refresh()" />
            </div>
            <SelectButton :modelValue="reports.filter.value" @update:modelValue="(v:string)=>reports.setFilter(v)" :options="reportFilters" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="mt-3 flex-wrap max-w-full" />
            <div v-if="reports.loading.value" class="py-6 grid place-items-center">
              <ProgressSpinner style="width:22px;height:22px" :strokeWidth="6" />
            </div>
            <div v-else-if="reports.reports.value.length" class="mt-3 space-y-2">
              <div v-for="r in reports.reports.value" :key="r.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
                <div class="flex items-center gap-2 min-w-0">
                  <Avatar :image="avatarSrcFor(r.reporter)" shape="circle" class="!w-8 !h-8 shrink-0 [&_img]:object-cover" />
                  <div class="min-w-0 flex-1">
                    <div class="text-[13px] font-semibold truncate dark:text-white">{{ r.reason_label || r.reason }} · {{ r.target_type }} #{{ r.target_id }}</div>
                    <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">от {{ r.reporter?.name || '?' }} · {{ r.target_title || '' }}</div>
                  </div>
                  <Tag v-if="r.status !== 'pending'" :value="r.status === 'resolved' ? 'принята' : 'отклонена'" :severity="r.status === 'resolved' ? 'success' : 'secondary'" class="!text-[9px]" />
                </div>
                <p v-if="r.description" class="mt-2 text-[13px] text-stone-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{{ r.description }}</p>
                <div v-if="r.status === 'pending'" class="mt-2 flex gap-1.5">
                  <Button @click="reports.resolve(r.id, 'resolved')" :loading="reports.actingId.value === r.id" label="Принято" size="small" rounded severity="success" class="!text-xs" />
                  <Button @click="reports.resolve(r.id, 'dismissed')" :loading="reports.actingId.value === r.id" label="Отклонить" size="small" rounded outlined severity="secondary" class="!text-xs" />
                </div>
              </div>
            </div>
            <div v-else class="mt-3 text-center py-4 text-sm text-stone-500 dark:text-zinc-400">Жалоб нет 🎉</div>
            <Message v-if="reports.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ reports.error.value }}</Message>
          </template>
        </Card>
        <Card class="!border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-900" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold dark:text-white">Скрыть мой профиль из поиска</div>
                <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Тебя не найдут через поиск, не откроют профиль и не увидят твои пины. Для остальных админов ты всё равно виден.</p>
              </div>
              <ToggleSwitch :modelValue="admin.selfHidden.value" @update:modelValue="(v:boolean)=>admin.toggleSelf(v)" :disabled="admin.selfLoading.value" class="shrink-0" :pt="{ root: { class: '!shrink-0' } }" />
            </div>
            <Message v-if="admin.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ admin.error.value }}</Message>
          </template>
        </Card>
        <Card class="!border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-900" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-sm font-semibold dark:text-white">Скрыть / удалить чужой аккаунт</div>
            <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Найди по имени или email (мин. 2 символа). Скрытый пропадает из поиска, профиля и карты у обычных пользователей.</p>
            <IconField class="mt-3">
              <InputIcon class="pi pi-search" />
              <InputText :modelValue="admin.query.value" @update:modelValue="(v:string|undefined)=>admin.query.value=v ?? ''" placeholder="Имя или email..." fluid size="small" rounded />
            </IconField>
            <div v-if="admin.searching.value" class="py-4 grid place-items-center"><ProgressSpinner style="width:22px;height:22px" :strokeWidth="6" /></div>
            <div v-else-if="admin.results.value.length" class="mt-3 divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
              <div v-for="u in admin.results.value" :key="u.id" class="flex items-center justify-between gap-2 p-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <Avatar :image="avatarSrcFor(u)" shape="circle" size="normal" class="!w-9 !h-9 [&_img]:object-cover" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate dark:text-white">{{ u.name }}</div>
                    <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ u.email }} · {{ u.plan }}</div>
                    <Tag v-if="u.is_hidden_from_search" value="скрыт" severity="contrast" class="!text-[9px] !mt-1" />
                  </div>
                </div>
                <div class="flex gap-1.5 shrink-0 items-center">
                  <Button @click="admin.toggleUser(u)" :loading="admin.togglingId.value === u.id" :label="u.is_hidden_from_search ? 'Показать' : 'Скрыть'" size="small" rounded :outlined="!u.is_hidden_from_search" class="!text-xs" :severity="u.is_hidden_from_search ? 'success' : 'secondary'" />
                  <Button v-if="imp" @click="imp.ask(u)" :disabled="!!u.is_admin" icon="pi pi-sign-in" size="small" rounded outlined severity="warn" title="Войти в аккаунт" />
                  <Button @click="admin.askDelete(u)" :disabled="u.is_admin" icon="pi pi-trash" size="small" rounded outlined severity="danger" title="Удалить вообще" />
                </div>
              </div>
            </div>
            <div v-else-if="admin.query.value.trim().length >= 2 && !admin.searching.value" class="mt-3 text-center py-4 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено</div>
          </template>
        </Card>
      </div>
      <Dialog :visible="!!admin.confirmDelete.value" @update:visible="(v:boolean)=>{ if(!v) admin.closeConfirm() }" modal header="Удалить аккаунт?" :style="{ width: '400px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600 dark:text-zinc-300">Удалить <b>{{ admin.confirmDelete.value?.name }}</b> ({{ admin.confirmDelete.value?.email }}) вообще? Это нельзя отменить.</p>
        <template #footer>
          <Button label="Отмена" text @click="admin.closeConfirm()" />
          <Button label="Удалить" severity="danger" :loading="admin.deletingId.value !== null" @click="admin.doDelete()" />
        </template>
      </Dialog>
    </template>
  </Card>
</template>
