<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Textarea from 'primevue/textarea'
import SelectButton from 'primevue/selectbutton'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { onMounted } from 'vue'
import { useAdminSupport, supportStatusLabel, supportStatusSeverity, type SupportFilter } from '@/composables/useAdminSupport'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { useAppConfirm } from '@/composables/useAppConfirm'

/**
 * Секция «Обращения» консоли: список тикетов + разбор выбранного.
 *
 * Логика вся в `useAdminSupport`, здесь только отображение и вызовы.
 * Сетка две колонки на десктопе, на мобиле детали едут под списком.
 */
const support = useAdminSupport()
const { userProfileUrl } = useProfileUrl()
const { confirmDelete } = useAppConfirm()

const filterOptions: Array<{ label: string; value: SupportFilter }> = [
  { label: 'Новые', value: 'new' },
  { label: 'Отвеченные', value: 'answered' },
  { label: 'Отклонённые', value: 'rejected' },
  { label: 'Все', value: 'all' },
]

onMounted(() => support.init())

function fmtTime(raw: unknown): string {
  if (!raw) return ''
  try {
    return new Date(String(raw)).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function profileHref(ticket: any): string | null {
  const user = ticket?.user ?? (ticket?.user_id ? { id: ticket.user_id } : null)
  if (!user) return null
  try {
    return userProfileUrl(user)
  } catch {
    return null
  }
}

async function askReject(): Promise<void> {
  const ticket = support.selected.value
  if (!ticket) return
  const hasReason = support.replyText.value.trim().length > 0
  const ok = await confirmDelete(
    hasReason
      ? `Закрыть обращение #${ticket.id}? Текст выше уйдёт пользователю письмом как причина.`
      : `Закрыть обращение #${ticket.id} без ответа? Письмо пользователю не уйдёт.`,
    'Отклонить обращение?',
  ).catch(() => false)
  if (!ok) return
  await support.rejectSelected()
}
</script>
<template>
  <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
    <Card class="!rounded-3xl !border-stone-200 !bg-white dark:!border-zinc-800 dark:!bg-zinc-900" :pt="{ body: { class: '!p-3 sm:!p-4' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="flex items-center gap-2 px-1 pb-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white"><i class="pi pi-inbox text-sm" /></span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-black dark:text-white">Обращения</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">
              {{ support.newCount.value > 0 ? `новых: ${support.newCount.value}` : 'новых нет' }}
            </div>
          </div>
          <Button icon="pi pi-refresh" rounded text size="small" :loading="support.loading.value" aria-label="Обновить" @click="support.refresh()" />
        </div>
        <SelectButton
          :model-value="support.filter.value"
          :options="filterOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          class="w-full !grid !grid-cols-4 !gap-1 !bg-transparent !border-0 !p-0 mb-3"
          :pt="{ pcToggleButton: { root: { class: '!rounded-full !text-xs !font-bold !px-2 !py-1.5' } } }"
          @update:model-value="(v: SupportFilter) => support.setFilter(v)"
        />
        <div v-if="support.loading.value && !support.hasData.value" class="grid place-items-center py-10">
          <ProgressSpinner style="width:26px;height:26px" :strokeWidth="6" />
        </div>
        <Message v-else-if="support.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ support.error.value }}</Message>
        <div v-else-if="!support.hasData.value" class="py-10 text-center">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-xl dark:bg-zinc-800">📭</div>
          <div class="mt-3 text-sm font-semibold dark:text-white">Пусто</div>
          <div class="mt-1 text-xs text-stone-500 dark:text-zinc-400">Обращений с таким статусом нет</div>
        </div>
        <div v-else class="space-y-1.5">
          <button
            v-for="t in support.tickets.value"
            :key="t.id"
            type="button"
            class="w-full rounded-2xl border p-2.5 text-left transition"
            :class="Number(support.selectedId.value) === Number(t.id)
              ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-500/10'
              : 'border-transparent hover:bg-stone-50 dark:hover:bg-zinc-800'"
            @click="support.select(Number(t.id))"
          >
            <div class="flex items-center gap-2.5">
              <Avatar :image="support.avatarSrcFor(t.user) || undefined" icon="pi pi-user" shape="circle" class="!h-9 !w-9 shrink-0 !bg-violet-100 !text-violet-600 dark:!bg-violet-500/20 dark:!text-violet-300 [&_img]:object-cover" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-[13px] font-bold dark:text-white">{{ t.subject }}</span>
                  <span v-if="t.status === 'new'" class="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                </div>
                <div class="truncate text-xs text-stone-500 dark:text-zinc-400">{{ t.name }} · {{ fmtTime(t.created_at) }}</div>
              </div>
              <Tag :value="supportStatusLabel(t.status)" :severity="supportStatusSeverity(t.status)" class="!text-[10px]" />
            </div>
            <div class="mt-1 truncate pl-[46px] text-xs text-stone-500 dark:text-zinc-400">{{ t.message }}</div>
          </button>
        </div>
        <div v-if="support.lastPage.value > 1" class="mt-3 flex items-center justify-between px-1">
          <Button label="← Назад" link size="small" :disabled="support.page.value <= 1" @click="support.setPage(support.page.value - 1)" />
          <span class="text-xs text-stone-500 dark:text-zinc-400">{{ support.page.value }} / {{ support.lastPage.value }}</span>
          <Button label="Дальше →" link size="small" :disabled="!support.hasMore.value" @click="support.setPage(support.page.value + 1)" />
        </div>
      </template>
    </Card>

    <Card class="!rounded-3xl !border-stone-200 !bg-white dark:!border-zinc-800 dark:!bg-zinc-900" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div v-if="!support.selected.value" class="py-14 text-center">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-xl dark:bg-zinc-800">👈</div>
          <div class="mt-3 text-sm font-semibold dark:text-white">Выбери обращение слева</div>
          <div class="mt-1 text-xs text-stone-500 dark:text-zinc-400">Здесь появятся вопрос пользователя и форма ответа</div>
        </div>
        <article v-else>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">Обращение #{{ support.selected.value.id }}</span>
            <Tag :value="supportStatusLabel(support.selected.value.status)" :severity="supportStatusSeverity(support.selected.value.status)" />
            <span class="ml-auto text-xs text-stone-400 dark:text-zinc-500">{{ fmtTime(support.selected.value.created_at) }}</span>
          </div>
          <h2 class="mt-2 text-lg font-black leading-snug dark:text-white">{{ support.selected.value.subject }}</h2>
          <div class="mt-3 flex items-center gap-2.5 rounded-2xl bg-stone-50 p-2.5 dark:bg-zinc-800/70">
            <Avatar :image="support.avatarSrcFor(support.selected.value.user) || undefined" icon="pi pi-user" shape="circle" class="!h-10 !w-10 shrink-0 !bg-violet-100 !text-violet-600 dark:!bg-violet-500/20 dark:!text-violet-300 [&_img]:object-cover" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold dark:text-white">{{ support.selected.value.name }}</div>
              <a :href="`mailto:${support.selected.value.email}`" class="block truncate text-xs text-violet-600 hover:underline dark:text-violet-300">{{ support.selected.value.email }}</a>
            </div>
            <a
              v-if="profileHref(support.selected.value)"
              :href="profileHref(support.selected.value) || '#'"
              class="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <i class="pi pi-user text-[11px]" /> Профиль
            </a>
          </div>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-zinc-200">{{ support.selected.value.message }}</p>
          <div v-if="support.selected.value.admin_reply" class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-500/10">
            <div class="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
              Ответ{{ support.selected.value.replier ? ` · ${support.selected.value.replier.name}` : '' }}{{ support.selected.value.replied_at ? ` · ${fmtTime(support.selected.value.replied_at)}` : '' }}
            </div>
            <p class="mt-1 whitespace-pre-wrap text-sm text-stone-700 dark:text-zinc-200">{{ support.selected.value.admin_reply }}</p>
          </div>
          <div v-if="support.selected.value.status === 'new'">
            <label class="mt-4 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Ответ пользователю</label>
            <Textarea
              :model-value="support.replyText.value"
              rows="5"
              maxlength="2000"
              placeholder="Напиши ответ — уйдёт письмом на почту пользователя…"
              class="mt-1 w-full !rounded-2xl"
              @update:model-value="(v: string) => (support.replyText.value = v)"
            />
            <div class="mt-1 flex items-center justify-between">
              <span class="text-[11px] text-stone-400 dark:text-zinc-500">При отклонении непустой текст уйдёт письмом как причина</span>
              <span class="text-[11px] text-stone-400 dark:text-zinc-500">{{ support.replyText.value.trim().length }}/2000</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button label="Ответить" icon="pi pi-send" rounded :loading="support.sending.value" :disabled="support.replyText.value.trim().length < 2" @click="support.sendReply()" />
              <Button label="Отклонить" icon="pi pi-times" rounded severity="danger" outlined :disabled="support.sending.value" @click="askReject()" />
            </div>
          </div>
          <Message v-else severity="info" :closable="false" class="mt-4 !rounded-2xl !text-xs">Обращение закрыто. Повторный ответ переоткроет его как отвеченное.</Message>
          <div v-if="support.selected.value.status !== 'new'" class="mt-2">
            <Textarea
              :model-value="support.replyText.value"
              rows="3"
              maxlength="2000"
              placeholder="Новый ответ — переоткроет обращение…"
              class="w-full !rounded-2xl"
              @update:model-value="(v: string) => (support.replyText.value = v)"
            />
            <div class="mt-2">
              <Button label="Ответить снова" icon="pi pi-send" rounded size="small" :loading="support.sending.value" :disabled="support.replyText.value.trim().length < 2" @click="support.sendReply()" />
            </div>
          </div>
        </article>
      </template>
    </Card>
  </div>
</template>
