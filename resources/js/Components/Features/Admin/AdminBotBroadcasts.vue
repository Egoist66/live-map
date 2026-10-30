<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'

const props = defineProps<{ bb: any }>()

const confirmRemove = ref(false)
let offLive: (() => void) | null = null

onMounted(() => {
  try {
    offLive = props.bb.bindLive()
  } catch {}
})

onUnmounted(() => {
  try {
    offLive?.()
  } catch {}
  offLive = null
})

/**
 * Подпись статуса рассылки.
 *
 * @param status draft|sending|sent|closed
 * @returns человеческий текст
 */
function statusLabel(status: string): string {
  if (status === 'sending') return 'идёт'
  if (status === 'sent') return 'готово'
  if (status === 'closed') return 'закрыта'
  return 'черновик'
}

/**
 * Цвет статуса для PrimeVue Tag.
 *
 * @param status draft|sending|sent|closed
 * @returns severity
 */
function statusSeverity(status: string): string {
  if (status === 'sent') return 'success'
  if (status === 'sending') return 'warn'
  if (status === 'closed') return 'secondary'
  return 'info'
}

/**
 * Короткая дата публикации.
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

/**
 * Доля голосов варианта от всех голосов (для полосы).
 *
 * @param votes голосов за вариант
 * @param total голосов всего
 * @returns проценты 0..100
 */
function pct(votes: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((votes / total) * 100))
}

/**
 * Строка имён по варианту: первые N + «…и ещё K».
 *
 * @param opt вариант из breakdown (voters может не быть у старого кэша)
 * @returns «Иван, Мария …и ещё 12» или пусто
 */
function votersLabel(opt: { votes: number; voters?: string[] }): string {
  const shown = Array.isArray(opt.voters) ? opt.voters : []
  const hidden = Math.max(0, (opt.votes ?? 0) - shown.length)
  const names = shown.join(', ')

  if (!names) return ''
  return hidden > 0 ? `${names} …и ещё ${hidden}` : names
}

/**
 * Открыть карточку рассылки.
 *
 * @param id id рассылки
 */function open(id: number): void {
  confirmRemove.value = false
  void props.bb.openDetail(id)
}

/**
 * Удаление в два тапа: первый вооружает, второй удаляет.
 *
 * @param id id рассылки
 */
function askRemove(id: number): void {
  if (!confirmRemove.value) {
    confirmRemove.value = true
    return
  }
  confirmRemove.value = false
  void props.bb.remove(id)
}
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Рассылки в боте</div>
        <Tag :value="`всего: ${bb.state.total}`" severity="info" class="!text-[9px]" />
        <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="bb.load()" />
      </div>
      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Публикации создаются через /publish прямо в боте. Здесь — доставка и голоса, финиш подтягивается сам.</p>
      <div v-if="bb.state.loading" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!bb.state.items.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Рассылок пока нет — начните с /publish в боте</div>
      <div v-else class="mt-3 space-y-2">
        <button v-for="row in bb.state.items" :key="row.id" type="button" class="w-full text-left rounded-2xl border border-stone-200 dark:border-white/10 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors" @click="open(row.id)">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg shrink-0">{{ row.type === 'poll' ? '📊' : '📝' }}</span>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold truncate dark:text-white">{{ row.title }}</div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">🗓 {{ fmt(row.published_at || row.created_at) }} · ✍️ {{ row.author_name || '—' }}</div>
            </div>
            <Tag :value="statusLabel(row.status)" :severity="statusSeverity(row.status)" class="!text-[9px] shrink-0" />
          </div>
          <div class="mt-2 flex items-center gap-3 text-[11px] text-stone-500 dark:text-zinc-400">
            <span>✅ {{ row.sent_count }}</span>
            <span v-if="row.failed_count">❌ {{ row.failed_count }}</span>
            <span v-if="row.type === 'poll'">🗳 {{ row.votes_count }}</span>
          </div>
        </button>
      </div>
      <Paginator v-if="bb.state.lastPage > 1" :rows="bb.state.perPage" :totalRecords="bb.state.total" :first="(bb.state.page - 1) * bb.state.perPage" @page="(e:any)=>bb.setPage(e.page + 1)" class="!bg-transparent !border-0 !px-0" />
      <Message v-if="bb.state.error" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ bb.state.error }}</Message>

      <Dialog v-model:visible="bb.state.dialogOpen" modal dismissableMask :draggable="false" class="w-[calc(100vw-2rem)] sm:!w-[28rem]" :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none overflow-hidden !border-stone-200 dark:!border-white/10' } }">
        <template #header>
          <div class="font-black text-sm dark:text-white pr-6">{{ bb.state.selected?.type === 'poll' ? '📊 Опрос' : '📝 Статья' }}</div>
        </template>
        <div v-if="bb.state.detailLoading" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
        <div v-else-if="bb.state.selected">
          <div class="text-sm font-bold dark:text-white">{{ bb.state.selected.type === 'poll' ? bb.state.selected.poll_question : bb.state.selected.title }}</div>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <Tag :value="statusLabel(bb.state.selected.status)" :severity="statusSeverity(bb.state.selected.status)" class="!text-[9px]" />
            <span class="text-[11px] text-stone-500 dark:text-zinc-400">✅ {{ bb.state.selected.sent_count }}<span v-if="bb.state.selected.failed_count"> · ❌ {{ bb.state.selected.failed_count }}</span><span v-if="bb.state.selected.type === 'poll'"> · 🗳 {{ bb.state.selected.votes_count }}</span></span>
            <Tag v-if="bb.state.selected.type === 'article' && bb.state.selected.has_photo" value="🖼 с обложкой" severity="info" class="!text-[9px]" />
            <Tag v-if="bb.state.selected.type === 'poll' && bb.state.selected.poll_multiple" value="✌️ несколько вариантов" severity="info" class="!text-[9px]" />
          </div>
          <div v-if="bb.state.selected.type === 'article' && bb.state.selected.body" class="mt-3 max-h-64 overflow-auto rounded-xl bg-stone-100 dark:bg-white/[0.06] px-3 py-2 text-[12px] whitespace-pre-wrap dark:text-zinc-100">{{ bb.state.selected.body }}</div>
          <div v-if="bb.state.selected.type === 'poll'" class="mt-3 space-y-2">
            <div v-for="(opt, i) in (bb.state.selected.breakdown || [])" :key="i" class="rounded-xl bg-stone-100 dark:bg-white/[0.06] px-3 py-2">
              <div class="flex items-center gap-2 text-[12px]">
                <span class="flex-1 truncate dark:text-white">{{ opt.option }}</span>
                <span class="shrink-0 font-bold text-stone-500 dark:text-zinc-300">{{ opt.votes }}</span>
              </div>
              <div class="mt-1 h-1.5 rounded-full bg-stone-200 dark:bg-white/10 overflow-hidden">
                <div class="h-full rounded-full bg-violet-500" :style="{ width: pct(opt.votes, bb.state.selected.votes_count) + '%' }" />
              </div>
              <details v-if="votersLabel(opt)" class="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400">
                <summary class="cursor-pointer select-none hover:text-stone-700 dark:hover:text-zinc-200">Кто голосовал</summary>
                <div class="admin-list-scroll !max-h-28 mt-1 rounded-lg bg-white px-2 py-1.5 leading-relaxed dark:bg-[#0F121F]">{{ votersLabel(opt) }}</div>
              </details>
            </div>
          </div>
          <div v-if="(bb.state.selected.recipients || []).length" class="mt-3">
            <div class="text-xs font-bold dark:text-white">Получатели <span class="font-semibold text-stone-400 dark:text-zinc-500">· всего {{ bb.state.selected.recipients_total }} (последние {{ bb.state.selected.recipients.length }})</span></div>
            <ul class="admin-list-scroll !max-h-48 mt-1.5 space-y-1 pr-1">
              <li v-for="(r, i) in bb.state.selected.recipients" :key="i" class="flex items-center gap-2 rounded-xl bg-stone-100 px-2.5 py-1.5 text-[12px] dark:bg-white/[0.06]">
                <span class="min-w-0 flex-1 truncate dark:text-white">{{ r.name }}</span>
                <Tag v-if="r.voted" value="голосовал" severity="success" class="!text-[9px] shrink-0" />
                <Tag v-else value="получил" severity="secondary" class="!text-[9px] shrink-0" />
              </li>
            </ul>
          </div>
          <div class="mt-4 flex justify-end">
            <Button :label="confirmRemove ? 'точно удалить?' : 'удалить'" severity="danger" :outlined="!confirmRemove" size="small" @click="bb.state.selected && askRemove(bb.state.selected.id)" />
          </div>
        </div>
      </Dialog>
    </template>
  </Card>
</template>
