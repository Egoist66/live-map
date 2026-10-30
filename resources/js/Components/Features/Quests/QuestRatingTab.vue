<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import { useRatingSystem } from '@/composables/useRatingSystem'

const rating = useRatingSystem()
</script>

<template>
  <div class="space-y-3">
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-2xl grid place-items-center shrink-0 bg-amber-500/15 text-amber-500"><i class="pi pi-star" /></span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-black text-stone-900 dark:text-white">Эта неделя · +{{ rating.weeklyTotal.value }} ★</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">Капы обнуляются в понедельник · неделя {{ rating.weekly.value?.week_key }}</div>
          </div>
          <Button icon="pi pi-refresh" text rounded size="small" :loading="rating.store.loading" aria-label="Обновить прогресс" @click="rating.refresh()" />
        </div>
        <div v-if="rating.activeActions.value.length" class="mt-3 space-y-2">
          <div v-for="a in rating.activeActions.value" :key="a.code">
            <div class="flex items-center gap-2 text-xs">
              <span class="flex-1 truncate text-stone-600 dark:text-zinc-300">{{ a.label }} · +{{ a.points }} ★</span>
              <span class="font-bold text-stone-500 dark:text-zinc-400 whitespace-nowrap">{{ a.used }}/{{ a.weekly_cap }}</span>
            </div>
            <ProgressBar :value="rating.capPercent(a.used, a.weekly_cap)" :show-value="false" class="!h-1.5 !mt-1" />
          </div>
        </div>
        <div v-else class="mt-2 text-xs text-stone-400">Пока тихо — лайкай, пиши, создавай: очки капают сразу.</div>
      </template>
    </Card>

    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-sm font-black text-stone-900 dark:text-white">Шкала рангов</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">У тебя {{ rating.score.value }} ★ · титул и уровень в профиле обновляются сами</div>
        <div class="mt-3 space-y-1.5">
          <div v-for="r in rating.ranks.value" :key="r.code" :class="['flex items-center gap-2.5 px-3 py-2 rounded-2xl border text-sm', r.reached ? 'bg-violet-500/10 border-violet-500/30' : 'bg-stone-50 dark:bg-white/[0.06]/50 border-stone-200 dark:border-white/10']">
            <i :class="[r.icon, r.reached ? 'text-violet-500' : 'text-stone-300 dark:text-zinc-600']" />
            <span :class="['flex-1 font-bold', r.reached ? 'text-stone-900 dark:text-white' : 'text-stone-400 dark:text-zinc-500']">{{ r.reached ? '✓ ' : '' }}{{ r.name }}</span>
            <span class="text-xs font-bold text-stone-400">{{ r.points }} ★</span>
          </div>
        </div>
      </template>
    </Card>

    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-sm font-black text-stone-900 dark:text-white">Сколько что даёт</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">Повтор по тому же объекту на неделе не платит: снял лайк и поставил заново — 0 ★</div>
        <div class="mt-3 divide-y divide-stone-100 dark:divide-white/10">
          <div v-for="a in rating.catalog.value" :key="a.code" class="flex items-center gap-2 py-2 text-sm">
            <span class="flex-1 min-w-0 text-stone-600 dark:text-zinc-300">{{ a.label }}</span>
            <span class="font-black text-emerald-500 whitespace-nowrap">+{{ a.points }} ★</span>
            <span class="text-[11px] text-stone-400 whitespace-nowrap">×{{ a.weekly_cap }}/нед</span>
          </div>
        </div>
        <div class="mt-3 text-[11px] leading-relaxed text-stone-400 dark:text-zinc-500">
          Задания выше дают XP сверху — системы складываются. Каждый понедельник утром приходит итог недели в колокольчик.
        </div>
      </template>
    </Card>
  </div>
</template>
