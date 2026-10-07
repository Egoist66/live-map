<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useProfileStats } from '@/composables/useProfileStats'
import { chatApi } from '@/services/chat.api'

/**
 * Вкладка «Приложение → Статистика»: только отображение.
 * Вся логика (загрузка, выгрузка, гейт по тарифу) — в useProfileStats.
 * Выгрузка CSV живёт в Telegram-боте (/export), здесь — живые таблицы.
 */
const stats = useProfileStats()
const chatLoadingId = ref<number | null>(null)

onMounted(() => {
  void stats.load()
})

function planLabel(plan: string): string {
  if (plan === 'pro') return 'PRO'
  if (plan === 'premium') return 'Premium'
  if (plan === 'business') return 'Business'
  return 'Free'
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

/**
 * Короткая дата дня для таблицы динамики.
 *
 * @param day день в формате Y-m-d
 */
function fmtDay(day: string): string {
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return day
  }
}

/**
 * День недели для строки динамики («пн», «вт» …).
 *
 * @param day день в формате Y-m-d
 */
function fmtWeekday(day: string): string {
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString('ru-RU', { weekday: 'short' })
  } catch {
    return ''
  }
}

/**
 * Дата и время визита гостя.
 *
 * @param iso ISO-строка визита
 */
function fmtVisitedAt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function profileUrl(visitor: { profile_slug?: string | null; id: number }): string {
  return `/users/${visitor.profile_slug || visitor.id}`
}

function openProfile(visitor: { profile_slug?: string | null; id: number }): void {
  router.visit(profileUrl(visitor))
}

async function writeTo(visitorId: number): Promise<void> {
  chatLoadingId.value = visitorId
  try {
    const conversation = await chatApi.createConversation(visitorId)
    const conversationId = (conversation as { id?: number })?.id
    if (conversationId) {
      router.visit(`/chat/${conversationId}`)
    }
  } catch {
    /* toast уже показывает chatApi-ошибку через перехватчик */
  } finally {
    chatLoadingId.value = null
  }
}

function audienceMax(): number {
  const audience = stats.summary.value?.audience
  if (!audience) return 1
  const counts = audience.interests.map((item) => item.count)
  return Math.max(1, ...counts)
}
</script>

<template>
  <div class="space-y-4 min-w-0">
    <Card
      class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
      :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }"
    >
      <template #content>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-black tracking-tight text-lg dark:text-white">Статистика профиля</h3>
            <p class="text-sm text-stone-500 mt-1">Кто смотрит анкету, кто лайкает и сколько вы в приложении.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Tag
              :value="planLabel(stats.summary.value?.plan ?? 'free')"
              severity="warn"
              class="!text-xs !font-bold"
            />
            <Button
              icon="pi pi-download"
              label="CSV"
              size="small"
              outlined
              severity="secondary"
              :loading="stats.state.value.exporting"
              :disabled="stats.loading.value || !stats.summary.value"
              title="CSV-выгрузка — та же, что в боте по /export"
              aria-label="Выгрузить статистику в CSV"
              @click="stats.exportCsv()"
            />
          </div>
        </div>

        <div v-if="stats.loading.value" class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton v-for="n in 4" :key="n" height="5.5rem" borderRadius="1rem" />
        </div>

        <Message v-else-if="stats.state.value.error" severity="error" class="mt-5 !text-sm">
          {{ stats.state.value.error }}
          <Button label="Повторить" link size="small" class="!px-1" @click="stats.load()" />
        </Message>

        <div v-else-if="stats.summary.value" class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-widest text-stone-400">Вы в приложении</p>
            <p class="mt-1 text-xl font-black dark:text-white">{{ minutesLabel(stats.summary.value.time.today_min) }}</p>
            <p class="text-xs text-stone-500 mt-0.5">неделя — {{ minutesLabel(stats.summary.value.time.week_min) }}</p>
          </div>
          <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-widest text-stone-400">Лайки вам</p>
            <p class="mt-1 text-xl font-black dark:text-white">{{ stats.summary.value.likes.week }}</p>
            <p class="text-xs text-stone-500 mt-0.5">за неделю · {{ stats.summary.value.likes.month }} за месяц</p>
          </div>
          <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-widest text-stone-400">Просмотры</p>
            <p class="mt-1 text-xl font-black dark:text-white">{{ stats.summary.value.views.week }}</p>
            <p class="text-xs text-stone-500 mt-0.5">за неделю · {{ stats.summary.value.views.month }} за месяц</p>
          </div>
          <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-widest text-stone-400">Мэтчи</p>
            <p class="mt-1 text-xl font-black dark:text-white">{{ stats.summary.value.matches_total }}</p>
            <p class="text-xs text-stone-500 mt-0.5">непрочитанных — {{ stats.summary.value.unread }}</p>
          </div>
        </div>

        <Message severity="info" class="!mt-4 !text-xs" :closable="false">
          Та же статистика — в Telegram-боте: /stats текстом, /export файлом CSV.
        </Message>
      </template>
    </Card>

    <Card
      class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
      :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }"
    >
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Динамика по дням</h3>
        <p class="text-sm text-stone-500 mt-1">Последние 14 дней: время в приложении, лайки и просмотры.</p>

        <div v-if="stats.loading.value" class="mt-4 space-y-2">
          <Skeleton height="2.5rem" borderRadius="0.75rem" />
          <Skeleton height="2.5rem" borderRadius="0.75rem" />
          <Skeleton height="2.5rem" borderRadius="0.75rem" />
        </div>

        <div v-else-if="stats.summary.value" class="mt-4 min-w-0">
          <div class="overflow-x-auto -mx-1 px-1">
            <div class="min-w-[520px]">
              <DataTable
                :value="stats.summary.value.daily"
                size="small"
                stripedRows
                paginator
                :rows="7"
                :rowsPerPageOptions="[7, 14]"
                sortField="day"
                :sortOrder="-1"
                class="!text-[13px]"
              >
                <Column field="day" header="Дата" sortable>
                  <template #body="{ data }">{{ fmtDay(data.day) }}<span class="text-stone-400 dark:text-zinc-500"> · {{ fmtWeekday(data.day) }}</span></template>
                </Column>
                <Column field="min" header="В приложении" sortable>
                  <template #body="{ data }">{{ minutesLabel(data.min) }}</template>
                </Column>
                <Column field="likes" header="Лайки" sortable>
                  <template #body="{ data }"><span class="font-bold text-rose-500">💞 {{ data.likes }}</span></template>
                </Column>
                <Column field="views" header="Просмотры" sortable>
                  <template #body="{ data }"><span class="font-bold text-sky-500">👀 {{ data.views }}</span></template>
                </Column>
              </DataTable>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card
      class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
      :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }"
    >
      <template #content>
        <div class="flex items-center gap-2">
          <h3 class="font-black tracking-tight text-lg dark:text-white">Кто вас лайкает</h3>
          <Tag value="PRO" severity="info" class="!text-[11px] !font-bold" />
        </div>
        <p class="text-sm text-stone-500 mt-1">Интересы, возраст и пол поклонников за последний месяц.</p>

        <div v-if="stats.loading.value" class="mt-4 space-y-2">
          <Skeleton height="2.5rem" borderRadius="0.75rem" />
          <Skeleton height="2.5rem" borderRadius="0.75rem" />
        </div>

        <div v-else-if="stats.isPro.value && stats.summary.value?.audience" class="mt-4 space-y-4">
          <div v-if="stats.summary.value.audience.interests.length > 0">
            <p class="text-xs font-bold uppercase tracking-widest text-stone-400">Топ интересов</p>
            <div class="mt-2 space-y-2">
              <div v-for="item in stats.summary.value.audience.interests.slice(0, 8)" :key="item.tag">
                <div class="flex items-center justify-between gap-2 text-sm">
                  <Tag :value="item.tag" severity="secondary" class="!text-xs" />
                  <span class="text-xs text-stone-500 shrink-0">×{{ item.count }}</span>
                </div>
                <ProgressBar :value="Math.round((item.count / audienceMax()) * 100)" :showValue="false" class="!h-1.5 !mt-1" />
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-stone-500 mt-2">Пока мало данных — как только прилетят лайки, здесь появится разбор.</p>
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="rounded-2xl bg-stone-50 dark:bg-zinc-800/60 px-4 py-3">
              <p class="text-xs font-bold uppercase tracking-widest text-stone-400">Возраст</p>
              <p class="text-sm mt-1 dark:text-white">
                18–24: <b>{{ stats.summary.value.audience.age_buckets['18-24'] ?? 0 }}</b>
                · 25–34: <b>{{ stats.summary.value.audience.age_buckets['25-34'] ?? 0 }}</b>
                · 35–44: <b>{{ stats.summary.value.audience.age_buckets['35-44'] ?? 0 }}</b>
                · 45+: <b>{{ stats.summary.value.audience.age_buckets['45+'] ?? 0 }}</b>
              </p>
            </div>
            <div class="rounded-2xl bg-stone-50 dark:bg-zinc-800/60 px-4 py-3">
              <p class="text-xs font-bold uppercase tracking-widest text-stone-400">Пол</p>
              <p class="text-sm mt-1 dark:text-white">
                👨 <b>{{ stats.summary.value.audience.gender['male'] ?? 0 }}</b>
                · 👩 <b>{{ stats.summary.value.audience.gender['female'] ?? 0 }}</b>
              </p>
            </div>
          </div>
        </div>

        <Message v-else-if="!stats.loading.value" severity="warn" class="mt-4 !text-sm">
          Разбор аудитории — на тарифе PRO и выше: с какими интересами люди вас лайкают, их возраст и пол.
        </Message>
      </template>
    </Card>

    <Card
      class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
      :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }"
    >
      <template #content>
        <div class="flex items-center gap-2">
          <h3 class="font-black tracking-tight text-lg dark:text-white">Гости страницы</h3>
          <Tag value="Premium" severity="danger" class="!text-[11px] !font-bold" />
        </div>
        <p class="text-sm text-stone-500 mt-1">Кто заходил в ваш профиль: анкета целиком и кнопка «Написать».</p>

        <div v-if="stats.loading.value" class="mt-4 space-y-2">
          <Skeleton height="3.5rem" borderRadius="1rem" />
          <Skeleton height="3.5rem" borderRadius="1rem" />
        </div>

        <div v-else-if="stats.isPremium.value && stats.summary.value?.visitors" class="mt-4 min-w-0">
          <div v-if="stats.summary.value.visitors.length === 0" class="text-sm text-stone-500">
            Пока никто не заходил — поделитесь ссылкой на профиль, и гости появятся здесь.
          </div>
          <div v-else class="overflow-x-auto -mx-1 px-1">
            <div class="min-w-[560px]">
              <DataTable
                :value="stats.summary.value.visitors"
                size="small"
                stripedRows
                paginator
                :rows="5"
                :rowsPerPageOptions="[5, 10, 20]"
                sortField="viewed_at"
                :sortOrder="-1"
                class="!text-[13px]"
              >
                <Column header="Гость" sortable sortField="name">
                  <template #body="{ data }">
                    <span class="flex items-center gap-2 min-w-0">
                      <Avatar :image="data.avatar_url ?? undefined" :label="(data.name || '?').slice(0, 1)" shape="circle" />
                      <span class="min-w-0">
                        <span class="block text-sm font-bold truncate dark:text-white">{{ data.name }}<span v-if="data.age">, {{ data.age }}</span></span>
                        <span v-if="data.goal || data.interests?.length" class="block text-xs text-stone-500 truncate max-w-[220px]">
                          {{ data.goal ?? '' }}{{ data.goal && data.interests?.length ? ' · ' : '' }}{{ (data.interests ?? []).slice(0, 3).join(', ') }}
                        </span>
                      </span>
                    </span>
                  </template>
                </Column>
                <Column field="viewed_at" header="Заходил" sortable>
                  <template #body="{ data }">{{ fmtVisitedAt(data.viewed_at) }}</template>
                </Column>
                <Column header="" class="!w-[104px]">
                  <template #body="{ data }">
                    <span class="flex items-center gap-1.5 justify-end">
                      <Button
                        icon="pi pi-user"
                        size="small"
                        text
                        rounded
                        title="Открыть анкету"
                        aria-label="Открыть анкету гостя"
                        @click="openProfile(data)"
                      />
                      <Button
                        icon="pi pi-send"
                        size="small"
                        rounded
                        :loading="chatLoadingId === data.id"
                        :disabled="!data.can_message"
                        :title="data.can_message ? 'Написать' : (data.can_message_reason ?? 'Написать нельзя')"
                        aria-label="Написать гостю"
                        @click="writeTo(data.id)"
                      />
                    </span>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </div>

        <Message v-else-if="!stats.loading.value" severity="warn" class="mt-4 !text-sm">
          Конкретных гостей с анкетами видно на тарифе Premium: кто заходит, что у него в профиле и кнопка «Написать».
        </Message>
      </template>
    </Card>
  </div>
</template>
