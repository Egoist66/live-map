<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import AppFooter from '@/Layouts/AppFooter.vue'
import { useBusinessLanding } from '@/composables/useBusinessLanding'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'

const landing = useBusinessLanding()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100 antialiased overflow-x-hidden">
    <header class="native-safe-top sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/70 backdrop-blur border-b border-stone-200/60 dark:border-zinc-800">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" class="flex items-center gap-2 min-w-0 shrink-0">
          <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] sm:rounded-xl grid place-items-center text-white shadow-soft shrink-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500"><i class="pi pi-briefcase text-sm" /></span>
          <span class="font-black tracking-[-0.03em] text-[17px] sm:text-[19px] whitespace-nowrap">U<span class="font-light text-ink-600 dark:text-zinc-400">Pin</span> <span class="font-black text-[11px] sm:text-[12px] tracking-wide bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">Pro</span></span>
          <span class="hidden sm:inline ml-2 text-xs font-black tracking-wide text-indigo-600 dark:text-indigo-400 border-l border-stone-200 dark:border-zinc-700 pl-3">ДЛЯ БИЗНЕСА</span>
        </Link>
        <nav class="flex items-center gap-2 shrink-0">
          <Link :href="landing.loginCta.value.href"><Button :label="landing.loginCta.value.label" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-4 sm:!px-6 !py-2 sm:!py-2.5 !rounded-full !text-[13px] sm:!text-sm !font-semibold !border-0 shadow-soft whitespace-nowrap" /></Link>
        </nav>
      </div>
    </header>

    <section class="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-6 sm:gap-10 items-center">
      <div class="min-w-0">
        <div class="inline-flex max-w-full flex-wrap items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-full pl-1.5 pr-3 py-1 shadow-soft">
          <Tag class="!text-white !rounded-full !px-2.5 !py-1 !text-[11px] !font-bold tracking-wide !border-0 !bg-gradient-to-r !from-indigo-500 !to-violet-600"><span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block mr-1.5 align-middle"></span>{{ landing.content.badge }}</Tag>
          <span class="text-xs font-medium text-stone-600 dark:text-zinc-400 min-w-0 break-words">{{ landing.content.badgeNote }}</span>
        </div>
        <h1 class="mt-5 text-[32px] sm:text-[48px] lg:text-[60px] font-black tracking-[-0.04em] leading-[0.95] dark:text-white break-words text-balance">{{ landing.content.titleTop }}<br /><span class="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">{{ landing.content.titleAccent }}</span></h1>
        <p class="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-stone-600 dark:text-zinc-400 max-w-[560px]">{{ landing.content.description }}</p>
        <div class="mt-6 flex flex-col sm:flex-row gap-2.5">
          <Link :href="landing.primaryCta.value.href" class="w-full sm:w-auto"><Button :label="landing.primaryCta.value.label" class="w-full sm:w-auto !text-white !px-7 !py-3.5 !rounded-full !font-bold !border-0 shadow-soft !bg-gradient-to-r !from-indigo-500 !to-violet-600" /></Link>
          <Link :href="landing.loginCta.value.href" class="w-full sm:w-auto"><Button label="Войти в кабинет" severity="secondary" outlined class="w-full sm:w-auto !px-7 !py-3.5 !rounded-full !font-semibold !bg-white dark:!bg-zinc-900" /></Link>
        </div>
        <div class="mt-6 flex items-center gap-4 sm:gap-6 flex-wrap py-4 border-y border-stone-200/60 dark:border-zinc-800 max-w-[520px]">
          <div v-for="(stat, statIndex) in landing.content.stats" :key="stat.value" class="flex items-center gap-4 sm:gap-6">
            <div><div class="font-black text-xl tracking-tight">{{ stat.value }}</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">{{ stat.note }}</div></div>
            <div v-if="statIndex < landing.content.stats.length - 1" class="hidden sm:block w-px h-10 bg-stone-200 dark:bg-zinc-800"></div>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500">
          <span class="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 grid place-items-center shrink-0">✓</span> {{ landing.content.trust }}
        </div>
        <button type="button" class="mt-4 text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-80" @click="landing.switchToPerson()">Я персона, а не компания →</button>
      </div>

      <div class="relative w-full max-w-[560px] min-w-0 justify-self-center lg:justify-self-end">
        <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[28px] !shadow-float !p-3">
          <template #content>
            <div class="rounded-[18px] overflow-hidden relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-4 sm:p-5 min-h-[300px]">
              <div class="absolute -top-16 -right-16 w-64 h-64 bg-violet-500/30 rounded-full blur-[50px] pointer-events-none"></div>
              <div class="relative flex items-center gap-3">
                <span class="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 grid place-items-center text-2xl shrink-0">🏢</span>
                <div class="min-w-0">
                  <div class="text-white font-black text-lg leading-tight truncate">Ваша компания</div>
                  <div class="text-white/60 text-xs mt-0.5">УНП · адрес · телефон · часы</div>
                </div>
                <span class="ml-auto shrink-0 text-[11px] font-bold bg-emerald-400 text-indigo-950 rounded-full px-2.5 py-1">✓ Проверено</span>
              </div>
              <div class="relative mt-4 space-y-2">
                <div class="bg-white/95 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow">
                  <span class="w-9 h-9 rounded-xl bg-indigo-100 grid place-items-center text-base shrink-0">📍</span>
                  <div class="min-w-0 flex-1"><div class="text-[13px] font-bold truncate text-ink-900">Акция −20% до 22:00</div><div class="text-[11px] text-stone-500 truncate">ваш пин · в 1.45 раза заметнее</div></div>
                </div>
                <div class="bg-white/95 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow">
                  <span class="w-9 h-9 rounded-xl bg-violet-100 grid place-items-center text-base shrink-0">👁</span>
                  <div class="min-w-0 flex-1"><div class="text-[13px] font-bold truncate text-ink-900">1 240 просмотров за неделю</div><div class="text-[11px] text-stone-500 truncate">статистика в кабинете</div></div>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between px-1 pt-3 flex-wrap gap-2">
              <span class="text-xs text-stone-500 dark:text-zinc-500">Метка компании видна всем на карте</span>
              <span class="text-xs font-black bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">UPIN PRO</span>
            </div>
          </template>
        </Card>
      </div>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      <Card v-for="step in landing.content.steps" :key="step.title" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft">
        <template #content>
          <div class="w-11 h-11 rounded-xl text-white grid place-items-center bg-gradient-to-br from-indigo-500 to-violet-600"><i :class="`pi ${step.icon}`" /></div>
          <h3 class="mt-4 font-bold text-[15px] dark:text-white">{{ step.title }}</h3>
          <p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">{{ step.text }}</p>
        </template>
      </Card>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div class="bg-indigo-950 text-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-full blur-[60px] opacity-25 pointer-events-none"></div>
        <div class="relative">
          <Tag class="!bg-white/10 !border !border-white/15 !rounded-full !px-3 !py-1 !text-xs !font-medium !text-white">{{ landing.content.tariff.tag }}</Tag>
          <h3 class="mt-4 text-2xl font-black tracking-tight">{{ landing.content.tariff.title }}</h3>
          <p class="text-white/60 mt-2 max-w-xl leading-relaxed">{{ landing.content.tariff.text }}</p>
          <div class="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            <Tag v-for="chip in landing.content.tariff.chips" :key="chip" class="!bg-white/10 !border !border-white/15 !px-3.5 !py-2 !rounded-full !text-white">{{ chip }}</Tag>
          </div>
          <div class="mt-6"><Link :href="landing.primaryCta.value.href"><Button :label="landing.content.tariff.ctaLabel" outlined class="!border-white/25 !text-white !px-6 !py-3 !rounded-full !font-semibold hover:!bg-white/10" /></Link></div>
        </div>
      </div>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 pb-[calc(1.5rem+var(--sab))]">
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[24px] !shadow-soft">
        <template #content>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="min-w-0"><div class="text-[18px] sm:text-[20px] font-black tracking-tight dark:text-white text-balance">{{ landing.content.finalTitle }}</div><div class="text-sm text-stone-600 dark:text-zinc-400 mt-1">{{ landing.content.finalText }}</div></div>
            <Link :href="landing.primaryCta.value.href" class="w-full sm:w-auto shrink-0"><Button :label="landing.primaryCta.value.label" class="w-full sm:w-auto !text-white !px-8 !py-3.5 !rounded-full !font-bold !border-0 shadow-soft !bg-gradient-to-r !from-indigo-500 !to-violet-600" /></Link>
          </div>
        </template>
      </Card>
    </section>

    <AppFooter class="mt-auto w-full" />
  </div>
</template>
