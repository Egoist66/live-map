<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import { useMyRaters } from '@/composables/useMyRaters'
import { useProfileUrl } from '@/composables/useProfileUrl'
import DatingRatingStars from '@/Components/Features/Dating/DatingRatingStars.vue'
import ModeratedContent from '@/Components/Features/Moderation/ModeratedContent.vue'

const raters = useMyRaters()
const { userProfileUrl } = useProfileUrl()

/**
 * Короткая дата отзыва.
 *
 * @param iso ISO-дата с бэка
 * @returns «12 мая» или пусто
 */
function raterDate(iso: string | null): string {
  if (!iso) return ''

  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}
</script>
<template>
  <Dialog
    :visible="raters.state.open"
    @update:visible="(v: boolean) => (v ? void raters.open() : raters.close())"
    modal
    :draggable="false"
    :closable="false"
    :dismissable-mask="true"
    header="Кто меня оценил"
    :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden' }, header: { class: '!p-0 !border-0' }, content: { class: '!p-0 !bg-white dark:!bg-[#0F121F]' } }"
  >
    <template #header>
      <div class="w-full flex items-center gap-2.5 px-5 pt-5 pb-3">
        <span class="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center text-white shadow shrink-0"><i class="pi pi-star-fill text-sm"></i></span>
        <div class="min-w-0 flex-1">
          <div class="text-[15px] font-black dark:text-white leading-none">Кто меня оценил</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            {{ raters.state.total > 0 ? `оценок: ${raters.state.total}` : 'пока без оценок' }}
          </div>
        </div>
        <Button icon="pi pi-times" rounded text size="small" class="!w-8 !h-8 shrink-0 !border-0 !shadow-none" aria-label="Закрыть" @click="raters.close()" />
      </div>
    </template>
    <div class="px-4 pb-[calc(1rem+var(--sab))]">
      <div v-if="raters.state.loading" class="py-8 grid place-items-center"><ProgressSpinner class="!w-7 !h-7" /></div>
      <div v-else-if="raters.state.error" class="py-6 text-center">
        <p class="text-xs text-red-500">{{ raters.state.error }}</p>
        <Button label="Попробовать ещё" text size="small" class="!text-xs mt-1" @click="raters.load()" />
      </div>
      <template v-else>
        <div v-if="raters.state.summary.avg != null || raters.state.total > 0" class="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 px-3.5 py-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl font-black text-stone-900 dark:text-white leading-none">{{ raters.state.summary.avg ?? '—' }}</span>
            <span class="min-w-0 flex-1">
              <DatingRatingStars :avg="raters.state.summary.avg" :count="raters.state.total" tone="light" />
              <span class="block mt-1 text-[11px] text-stone-500 dark:text-zinc-400">средняя оценка · {{ raters.state.total }}</span>
            </span>
          </div>
          <div class="mt-2.5 space-y-1">
            <div v-for="stars in [5, 4, 3, 2, 1]" :key="stars" class="flex items-center gap-2">
              <span class="w-3 text-right text-[11px] font-bold text-stone-500 dark:text-zinc-400">{{ stars }}</span>
              <i class="pi pi-star-fill text-[10px] text-amber-400 shrink-0" />
              <span class="flex-1 h-1.5 rounded-full bg-stone-200 dark:bg-white/10 overflow-hidden">
                <span class="block h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 transition-all" :style="{ width: `${(Number(raters.state.distribution[stars] ?? 0) / raters.maxBucket.value) * 100}%` }" />
              </span>
              <span class="w-6 text-[11px] text-stone-400 dark:text-zinc-500">{{ raters.state.distribution[stars] ?? 0 }}</span>
            </div>
          </div>
        </div>

        <div v-if="raters.state.locked" class="mt-3 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-500/10 dark:to-fuchsia-500/10 px-4 py-4 text-center">
          <span class="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30"><i class="pi pi-crown text-lg leading-none" /></span>
          <p class="mt-2 text-sm font-black text-stone-900 dark:text-white">Имена и отзывы видят Premium</p>
          <p class="mt-1 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
            {{ raters.state.total > 0 ? `Тебя оценили ${raters.state.total} — узнай кто и что написал.` : 'Как только появятся оценки — узнай кто и что написал.' }}
          </p>
          <Link href="/settings/billing" class="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 px-5 py-2.5 text-[13px] font-black text-white shadow-lg shadow-violet-500/30 active:scale-[0.98] transition">
            <i class="pi pi-crown text-xs" /> Выбрать Premium
          </Link>
        </div>

        <div v-else-if="!raters.state.raters.length" class="py-6 text-center text-xs text-stone-400 dark:text-zinc-500">
          Пока никто не оценил — оценки появятся после общения
        </div>

        <div v-else class="mt-3 max-h-[44dvh] overflow-y-auto overscroll-contain space-y-2">
          <div
            v-for="item in raters.state.raters"
            :key="item.id"
            class="rounded-2xl border border-stone-200/70 dark:border-white/10 px-3 py-2.5"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Avatar :image="item.author?.avatar_url ?? undefined" :label="!item.author?.avatar_url ? (item.author?.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-8 !h-8 !text-xs shrink-0" />
              <Link
                v-if="item.author"
                :href="userProfileUrl({ id: item.author.id, profile_slug: item.author.profile_slug })"
                class="min-w-0 flex-1 truncate text-[13px] font-bold text-stone-800 dark:text-zinc-100 hover:underline"
              >{{ item.author.name }}</Link>
              <span v-else class="min-w-0 flex-1 truncate text-[13px] font-bold text-stone-400">Скрытый профиль</span>
              <span class="inline-flex items-center gap-0.5 text-amber-400 shrink-0" aria-hidden="true">
                <i v-for="i in 5" :key="i" :class="['text-[10px]', i <= item.rating ? 'pi pi-star-fill' : 'pi pi-star']" />
              </span>
              <span class="text-[11px] text-stone-400 dark:text-zinc-500 shrink-0">{{ raterDate(item.created_at) }}</span>
            </div>
            <div v-if="item.body" class="mt-1.5 text-[13px] leading-snug text-stone-600 dark:text-zinc-300">
              <ModeratedContent :text="item.body" :moderation="item.moderation" />
            </div>
          </div>
          <Button
            v-if="raters.hasMore.value"
            label="Показать ещё"
            text
            size="small"
            :loading="raters.state.loadingMore"
            class="!px-0 !text-xs"
            @click="raters.loadMore()"
          />
        </div>
      </template>
    </div>
  </Dialog>
</template>
