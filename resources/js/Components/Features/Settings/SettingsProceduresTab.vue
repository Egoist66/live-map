<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

defineProps<{ proc: any }>()

function fmt(dt: string | null) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return dt }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <h3 class="font-black tracking-tight text-lg dark:text-white">Процедуры доступа</h3>
        <Tag v-if="proc.unread.value" :value="`новое: ${proc.unread.value}`" severity="danger" class="!text-[10px]" />
      </div>
      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Здесь фиксируется каждый служебный вход в ваш аккаунт.</p>

      <div class="mt-4 rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.05] p-4 text-[13px] leading-relaxed text-stone-700 dark:text-zinc-200 space-y-2">
        <p><b>Ваши права.</b> Тайна переписки и личных сообщений защищена <b>ст. 28 Конституции Республики Беларусь</b>. Незаконный просмотр чужих диалогов — это <b>ст. 203 УК РБ</b> (нарушение тайны переписки, для должностных лиц — до 2 лет лишения свободы), <b>ст. 349 УК РБ</b> (несанкционированный доступ к компьютерной информации) и <b>ст. 203-1 УК РБ</b> (незаконные действия с персональными данными).</p>
        <p><b>Наш принцип.</b> Мы действуем строго в соответствии с законом: вход в аккаунт возможен только <b>по решению или официальной просьбе соответствующих органов</b>, либо для устранения технической проблемы по вашему обращению. У команды сервиса есть технический доступ к серверам, но нет права читать переписку «из любопытства».</p>
        <p><b>Прозрачность.</b> Каждый такой вход записывается в журнал с датой и основанием и <b>показывается вам здесь</b>. Если вы не обращались в поддержку и не знаете об официальном запросе — это повод задать вопрос команде сервиса или обратиться с жалобой в правоохранительные органы.</p>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <div class="text-sm font-bold dark:text-white">Журнал доступов</div>
        <Button v-if="proc.unread.value" label="Отметить прочитанным" link size="small" class="!text-xs !px-1 ml-auto" @click="proc.markRead()" />
        <Button v-else label="обновить" link size="small" class="!text-xs !px-1 ml-auto" @click="proc.load()" />
      </div>
      <div v-if="proc.loading.value" class="py-6 grid place-items-center"><ProgressSpinner style="width:22px;height:22px" :strokeWidth="6" /></div>
      <div v-else-if="proc.items.value.length" class="mt-3 space-y-2">
        <div v-for="l in proc.items.value" :key="l.id" class="rounded-2xl border border-stone-200 dark:border-white/10 p-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-eye text-red-500 text-sm" />
            <div class="text-[13px] font-semibold dark:text-white flex-1">Служебный вход · {{ fmt(l.started_at) }}</div>
            <Tag v-if="!l.seen_at" value="новое" severity="danger" class="!text-[9px]" />
          </div>
          <div class="mt-1 text-[13px] text-stone-600 dark:text-zinc-300">Основание: {{ l.reason }}</div>
          <div class="mt-1 text-[11px] text-stone-400">Завершён: {{ fmt(l.ended_at) }}</div>
        </div>
      </div>
      <div v-else class="mt-3 text-center py-4 text-sm text-stone-500 dark:text-zinc-400">Входов не зафиксировано — всё спокойно ✓</div>
      <Message v-if="proc.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ proc.error.value }}</Message>
    </template>
  </Card>
</template>
