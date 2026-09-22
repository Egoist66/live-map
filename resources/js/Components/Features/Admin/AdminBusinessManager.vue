<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ queue: any }>()

const statusOptions = [
  { label: 'На проверке', value: 'pending' },
  { label: 'Проверены', value: 'verified' },
  { label: 'Отклонены', value: 'rejected' },
  { label: 'Все', value: 'all' },
]

/**
 * Цвет бейджа статуса проверки.
 * @param status verification_status
 */
function statusSeverity(status: string): string {
  if (status === 'verified') return 'success'
  if (status === 'pending') return 'warn'
  if (status === 'rejected') return 'danger'
  return 'secondary'
}

/**
 * Подпись статуса проверки.
 * @param status verification_status
 */
function statusLabel(status: string): string {
  if (status === 'verified') return 'проверен'
  if (status === 'pending') return 'на проверке'
  if (status === 'rejected') return 'отклонён'
  return 'черновик'
}

/**
 * Подпись формы собственности.
 * @param legalForm код формы
 */
function legalFormLabel(legalForm: string): string {
  const map: Record<string, string> = { ooo: 'ООО', ip: 'ИП', odo: 'ОДО', zao: 'ЗАО', self_employed: 'самозанятый', craft: 'ремесленник' }
  return map[legalForm] ?? legalForm ?? '—'
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Бизнес-заявки <span class="text-xs font-bold text-stone-400 dark:text-zinc-500">· {{ queue.total.value }}</span></div>
        <Tag v-if="queue.pendingCount.value > 0" :value="`на проверке: ${queue.pendingCount.value}`" severity="warn" class="!text-[10px] ml-auto" />
        <Button icon="pi pi-refresh" rounded text size="small" :loading="queue.loading.value" aria-label="Обновить очередь" @click="queue.load()" />
      </div>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="queue.query.value" @update:modelValue="(v:string|undefined)=>queue.setQuery(v ?? '')" placeholder="Название, УНП, email владельца..." fluid size="small" rounded />
      </IconField>
      <div class="mt-2.5">
        <SelectButton :modelValue="queue.status.value" @update:modelValue="(v:string)=>queue.setStatus(v as any)" :options="statusOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="flex-wrap max-w-full" />
      </div>
      <div v-if="queue.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!queue.items.value.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">
        {{ queue.status.value === 'pending' ? 'Заявок на проверке нет — новые прилетят сюда автоматически' : 'Ничего не найдено' }}
      </div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="b in queue.items.value" :key="b.id" class="rounded-2xl border border-stone-200 dark:border-zinc-700 p-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="relative shrink-0">
              <Avatar :image="b.logo_url || avatarSrcFor({ avatar_path: null })" shape="circle" class="!w-9 !h-9 [&_img]:object-cover" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold truncate dark:text-white">{{ b.name }} <span class="text-[11px] font-bold text-stone-400">· {{ legalFormLabel(b.legal_form) }}</span></div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">УНП {{ b.unp ?? '—' }} · {{ b.legal_address ?? 'юр. адрес не указан' }}</div>
              <div class="text-[11px] text-stone-400 dark:text-zinc-500 truncate">Владелец: {{ b.owner_name ?? `#${b.owner_id}` }} · {{ b.owner_email ?? '' }}</div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <Tag :value="statusLabel(b.verification_status)" :severity="statusSeverity(b.verification_status)" class="!text-[9px]" />
              <Tag v-if="b.is_organization" value="организация" severity="info" class="!text-[9px]" />
            </div>
          </div>
          <div v-if="b.director_name || b.phone || b.website" class="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400 truncate">
            {{ b.director_name ?? '' }}{{ b.phone ? ` · ${b.phone}` : '' }}{{ b.website ? ` · ${b.website}` : '' }}
          </div>
          <div v-if="b.verification_notes" class="mt-1.5 text-[12px] text-red-600 dark:text-red-400">Причина отказа: {{ b.verification_notes }}</div>
          <div v-if="b.verification_status === 'pending'" class="mt-2.5 flex gap-1.5 flex-wrap items-center">
            <Button label="Одобрить" icon="pi pi-check" size="small" rounded :loading="queue.actingId.value === b.id" class="!text-xs !bg-emerald-600 !border-emerald-600" @click="queue.verify(b)" />
            <Button label="Отклонить" icon="pi pi-times" size="small" rounded outlined severity="danger" :disabled="queue.actingId.value === b.id" class="!text-xs" @click="queue.askReject(b)" />
            <span class="flex-1" />
            <span class="text-[11px] text-stone-400">пинов: {{ b.pins_live ?? 0 }}</span>
          </div>
        </div>
      </div>
      <Paginator
        v-if="queue.lastPage.value > 1"
        :rows="20"
        :totalRecords="queue.total.value"
        :first="(queue.page.value - 1) * 20"
        class="mt-3"
        @page="(e:any)=>queue.setPage(e.page + 1)"
      />
      <Dialog :visible="!!queue.rejectTarget.value" @update:visible="(v:boolean)=>{ if(!v) queue.closeReject() }" modal header="Отклонить заявку?" :style="{ width: '420px', maxWidth: '94vw' }">
        <p class="text-sm text-stone-600 dark:text-zinc-300">Компания <b>{{ queue.rejectTarget.value?.name }}</b> увидит причину в кабинете.</p>
        <Textarea v-model="queue.rejectReason.value" rows="3" fluid placeholder="Причина отказа (минимум 3 символа)..." class="mt-3 !rounded-2xl" />
        <template #footer>
          <Button label="Отмена" text @click="queue.closeReject()" />
          <Button label="Отклонить" severity="danger" :disabled="queue.rejectReason.value.trim().length < 3" :loading="queue.actingId.value !== null" @click="queue.confirmReject()" />
        </template>
      </Dialog>
    </template>
  </Card>
</template>
