<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { useWelcome } from '@/composables/useWelcome'
import { useWelcomeMode, type LandingTab } from '@/composables/useWelcomeMode'
import { useWelcomeHeroSwiper } from '@/composables/useWelcomeHeroSwiper'
import AppFooter from '@/Layouts/AppFooter.vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Avatar from 'primevue/avatar'

const w = useWelcome()
const landing = useWelcomeMode()
const hero = useWelcomeHeroSwiper()

const tabOptions = [
  { label: 'ULove', icon: '💘', value: 'ulove' },
  { label: 'UPin', icon: '📍', value: 'upin' },
  { label: 'Business', icon: '🏢', value: 'business' },
] as const

const thumbGradient = {
  ulove: 'bg-gradient-to-r from-rose-400 via-fuchsia-400 to-orange-300',
  upin: 'bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400',
  business: 'bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400',
} as const

const thumbPosition = {
  ulove: 'translate-x-0',
  upin: 'translate-x-full',
  business: 'translate-x-[200%]',
} as const

function switchTab(next: LandingTab): void {
  landing.setTab(next)
}
</script>

<template>
  <Head :title="landing.seo.value.title">
    <meta head-key="description" name="description" :content="landing.seo.value.description" />
    <meta head-key="og:title" property="og:title" :content="landing.seo.value.title" />
    <meta head-key="og:description" property="og:description" :content="landing.seo.value.description" />
  </Head>
  <div class="min-h-screen flex flex-col bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100 antialiased selection:bg-rose-500 selection:text-white overflow-x-hidden">
    <div class="flex flex-col min-h-screen">
    <header class="native-safe-top sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/70 backdrop-blur border-b border-stone-200/60 dark:border-zinc-800">
      <div class="max-w-[1280px] mx-auto px-2 min-[411px]:px-4 sm:px-6 h-14 min-[411px]:h-[64px] flex items-center justify-between gap-2 min-w-0">
        <Link href="/" class="flex items-center gap-2 min-w-0 shrink-0">
          <span :class="['w-8 h-8 min-[411px]:w-9 min-[411px]:h-9 rounded-[10px] min-[411px]:rounded-xl grid place-items-center text-white shadow-soft transition-colors duration-300 shrink-0', landing.theme.value.logo]"><i :class="[landing.theme.value.logoIcon, 'text-sm']" /></span>
          <span class="font-black tracking-[-0.03em] text-[17px] min-[411px]:text-[19px] whitespace-nowrap">U<span class="font-light text-ink-600 dark:text-zinc-400">Pin</span></span>
          <span :class="['hidden sm:inline ml-2 text-xs font-black tracking-wide bg-clip-text text-transparent border-l border-stone-200 dark:border-zinc-700 pl-3', landing.headerTagClass.value]">{{ landing.headerTag.value }}</span>
        </Link>
        <nav class="flex items-center gap-1 min-[411px]:gap-2 shrink-0">
          <Link href="/map" class="hidden sm:inline-flex text-sm font-semibold text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2">Карта</Link>
          <Link :href="w.profileCtaHref.value"><Button :label="w.profileCtaLabel.value" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-4 min-[411px]:!px-6 !py-2 min-[411px]:!py-2.5 !rounded-full !text-[13px] min-[411px]:!text-sm !font-semibold hover:!bg-ink-800 dark:hover:!bg-zinc-100 !border-0 shadow-soft whitespace-nowrap" /></Link>
        </nav>
      </div>
    </header>

    <div class="max-w-[1280px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex flex-col items-center gap-2">
      <div class="text-[10px] font-black tracking-[0.22em] uppercase text-stone-400 dark:text-zinc-500">Выбери сторону</div>
      <div class="relative inline-flex max-w-full rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-stone-200/80 dark:border-zinc-700/60 p-1 shadow-soft">
        <span
          :class="['absolute top-1 bottom-1 left-1 w-[calc(33.333%-4px)] rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', thumbGradient[landing.tab.value], thumbPosition[landing.tab.value]]"
        ></span>
        <button
          v-for="opt in tabOptions"
          :key="opt.value"
          type="button"
          :class="['relative z-10 flex items-center gap-1 rounded-full px-3 min-[411px]:px-5 sm:px-7 py-2 text-[13px] min-[411px]:text-sm font-bold transition-colors duration-300 whitespace-nowrap', landing.tab.value === opt.value ? 'text-white' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white']"
          @click="switchTab(opt.value)"
        >
          <span class="text-[15px] leading-none">{{ opt.icon }}</span>{{ opt.label }}
        </button>
      </div>
    </div>

    <section class="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-10 pb-8 sm:pb-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-6 sm:gap-10 items-center overflow-hidden">
      <div class="min-w-0">
        <div class="inline-flex max-w-full flex-wrap items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-full pl-1.5 pr-3 py-1 shadow-soft min-w-0">
          <Tag :class="['!text-white !rounded-full !px-2.5 !py-1 !text-[11px] !font-bold tracking-wide !border-0 shrink-0', landing.theme.value.badge]"><span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block mr-1.5 align-middle"></span>{{ landing.content.value.badge }}</Tag>
          <span class="text-xs font-medium text-stone-600 dark:text-zinc-400 min-w-0 break-words">{{ landing.content.value.badgeNote }}</span>
        </div>
        <h1 class="mt-5 sm:mt-6 text-[30px] sm:text-[48px] lg:text-[64px] font-black tracking-[-0.04em] sm:tracking-[-0.05em] leading-[0.95] sm:leading-[0.85] dark:text-white break-words text-balance">{{ landing.content.value.titleTop }}<br /><span :class="landing.theme.value.accentText">{{ landing.content.value.titleAccent }}</span> {{ landing.content.value.titleTail }}</h1>
        <p class="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-stone-600 dark:text-zinc-400 max-w-[560px]">{{ landing.content.value.description }}</p>
        <div class="mt-6 sm:mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
          <Link :href="landing.primaryCta.value.href" class="w-full sm:w-auto"><Button :label="landing.primaryCta.value.label" :class="['w-full sm:w-auto !text-white !px-7 !py-3.5 !rounded-full !font-bold hover:opacity-90 !border-0 shadow-soft', landing.theme.value.ctaBtn]" /></Link>
          <a href="#how" class="w-full sm:w-auto"><Button :label="landing.content.value.secondaryLabel" severity="secondary" outlined class="w-full sm:w-auto !bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 !px-7 !py-3.5 !rounded-full !font-semibold hover:!bg-stone-50 dark:hover:!bg-zinc-800 !text-ink-900 dark:!text-white" /></a>
        </div>
        <div class="mt-6 sm:mt-8 flex items-center gap-4 sm:gap-6 flex-wrap py-4 sm:py-5 border-y border-stone-200/60 dark:border-zinc-800 max-w-[520px]">
          <div v-for="(stat, statIndex) in landing.content.value.stats" :key="stat.value" class="flex items-center gap-4 sm:gap-6">
            <div><div class="font-black text-xl sm:text-[22px] tracking-tight">{{ stat.value }}</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">{{ stat.note }}</div></div>
            <div v-if="statIndex < landing.content.value.stats.length - 1" class="hidden sm:block w-px h-10 bg-stone-200 dark:bg-zinc-800"></div>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500">
          <span class="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 grid place-items-center">✓</span> {{ landing.content.value.trust }}
        </div>
        <button type="button" :class="['mt-4 text-[13px] font-bold hover:opacity-80', landing.theme.value.accentText]" @click="switchTab(landing.isUlove.value ? 'upin' : 'ulove')">{{ landing.content.value.crossHint }}</button>
      </div>

      <div class="relative w-full max-w-[560px] min-w-0 justify-self-center lg:justify-self-end">
        <Card v-if="landing.isUlove.value" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[28px] !shadow-float !p-3">
          <template #content>
            <div
              class="aspect-[4/3.4] rounded-[18px] overflow-hidden relative bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700"
              @mouseenter="hero.pause()"
              @mouseleave="hero.resume()"
              @touchstart="hero.onTouchStart"
              @touchend="hero.onTouchEnd"
            >
              <div
                v-for="(profile, slideIndex) in hero.profiles.value"
                :key="profile.name"
                :class="['absolute inset-0 transition-all duration-700 ease-out', hero.slideClass(slideIndex)]"
              >
                <!-- Первый слайд — LCP лендинга: eager + high, остальные лениво.
                     Размеры держат интринсик до загрузки (600×600 у Ани,
                     800×640 у остальных — object-cover выравнивает). -->
                <img
                  :src="profile.photo"
                  class="absolute inset-0 w-full h-full object-cover"
                  :alt="`Анкета ULove — ${profile.name}`"
                  :loading="slideIndex === 0 ? 'eager' : 'lazy'"
                  :fetchpriority="slideIndex === 0 ? 'high' : 'auto'"
                  decoding="async"
                  width="800"
                  height="640"
                  @error="hero.onPhotoError(profile)"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20"></div>
                <div class="absolute top-4 left-4 right-4 flex justify-between items-center">
                  <Badge :value="profile.distance" class="!bg-white/90 !text-ink-900 !rounded-full !px-3 !py-1.5 !text-xs !font-bold !border-0" />
                  <Badge :value="profile.pin" class="!bg-black/50 !text-white !rounded-full !px-3 !py-1.5 !text-xs !font-bold !border !border-white/20" />
                </div>
                <div class="absolute bottom-4 left-4 right-4">
                  <div class="text-white font-black text-xl leading-tight">{{ profile.name }}, {{ profile.age }}</div>
                  <div class="mt-2 flex gap-1.5 flex-wrap">
                    <Tag
                      v-for="tag in profile.tags"
                      :key="tag"
                      class="!bg-white/15 !border !border-white/20 !text-white !rounded-full !px-2.5 !py-1 !text-[11px] !font-semibold"
                    >{{ tag }}</Tag>
                  </div>
                  <div class="mt-3 flex gap-2">
                    <Button icon="pi pi-times" rounded class="!w-12 !h-12 !bg-white !text-ink-900 !border-0 shadow-lg" aria-label="Пропустить" />
                    <Button icon="pi pi-heart-fill" rounded class="!w-12 !h-12 !bg-gradient-to-r !from-rose-500 !to-orange-400 !text-white !border-0 shadow-lg shadow-rose-500/30" aria-label="Лайк" />
                    <div class="ml-auto self-center bg-white/90 rounded-full px-3 py-2 text-xs font-bold text-ink-900">💬 мэтч → чат</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-center items-center gap-1 pt-3">
              <button
                v-for="(profile, dotIndex) in hero.profiles.value"
                :key="profile.name"
                type="button"
                :aria-label="`Показать ${profile.name}`"
                class="h-8 px-1.5 grid place-items-center"
                @click="hero.goTo(dotIndex)"
              >
                <span :class="['block h-2 rounded-full transition-all', dotIndex === hero.activeIndex.value ? 'w-6 bg-gradient-to-r from-rose-500 to-orange-400' : 'w-2 bg-stone-300 dark:bg-zinc-600']" />
              </button>
            </div>
            <div class="flex items-center justify-between px-1 pt-3">
              <div class="flex items-center gap-2">
                <Avatar image="/landing/face-1.jpg" aria-label="Пользователь UPin" shape="circle" size="normal" />
                <Avatar image="/landing/face-2.jpg" aria-label="Пользователь UPin" shape="circle" size="normal" class="-ml-4" />
                <Avatar image="/landing/face-3.jpg" aria-label="Пользователь UPin" shape="circle" size="normal" class="-ml-4" />
                <span class="text-xs font-medium text-stone-500 dark:text-zinc-500 ml-1">уже листают рядом</span>
              </div>
              <span class="text-xs font-black bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">ULOVE</span>
            </div>
          </template>
        </Card>

        <Card v-else-if="landing.tab.value === 'upin'" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[28px] !shadow-float !p-3">
          <template #content>
            <div class="rounded-[18px] overflow-hidden relative bg-gradient-to-br from-teal-600 via-indigo-700 to-[#0B0F1A] border border-stone-200 dark:border-zinc-700 p-4 sm:p-5 min-h-[320px]">
              <div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,.5) 0 2px, transparent 2px), radial-gradient(circle at 70% 20%, rgba(255,255,255,.4) 0 2px, transparent 2px), radial-gradient(circle at 85% 65%, rgba(255,255,255,.4) 0 2px, transparent 2px), radial-gradient(circle at 40% 75%, rgba(255,255,255,.35) 0 2px, transparent 2px); background-size: 90px 90px;"></div>
              <div class="absolute top-[22%] left-[16%] pointer-events-none"><span class="block w-9 h-9 rounded-full bg-white shadow-lg grid place-items-center text-base">☕</span></div>
              <div class="absolute top-[55%] left-[68%] pointer-events-none"><span class="block w-9 h-9 rounded-full bg-white shadow-lg grid place-items-center text-base">🐕</span></div>
              <div class="absolute top-[38%] left-[46%] pointer-events-none"><span class="block w-11 h-11 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg shadow-sky-500/40 grid place-items-center text-lg ring-4 ring-white/40">📍</span></div>
              <div class="relative flex flex-wrap items-center justify-between gap-2">
                <Badge value="📍 Рядом сейчас" class="!bg-white/90 !text-ink-900 !rounded-full !px-3 !py-1.5 !text-xs !font-bold !border-0 max-w-full" />
                <Badge value="без точного адреса" class="!bg-black/50 !text-white !rounded-full !px-3 !py-1.5 !text-xs !font-bold !border !border-white/20 max-w-full" />
              </div>
              <div class="relative mt-[38%] sm:mt-[34%] space-y-2">
                <div v-for="pin in landing.pinSamples" :key="pin.title" class="bg-white/95 dark:bg-zinc-900/95 backdrop-blur rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow min-w-0">
                  <span class="w-9 h-9 rounded-xl bg-stone-100 dark:bg-zinc-800 grid place-items-center text-base shrink-0">{{ pin.emoji }}</span>
                  <div class="min-w-0 flex-1"><div class="text-[13px] font-bold truncate dark:text-white">{{ pin.title }}</div><div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ pin.meta }}</div></div>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between px-1 pt-3 flex-wrap gap-2">
              <div class="flex gap-1.5 flex-wrap">
                <Tag v-for="chip in landing.pinChips" :key="chip" class="!bg-stone-100 dark:!bg-zinc-800 !text-ink-900 dark:!text-white !rounded-full !px-2.5 !py-1 !text-[11px] !font-semibold !border-0">{{ chip }}</Tag>
              </div>
              <span class="text-xs font-black bg-gradient-to-r from-teal-500 to-indigo-500 bg-clip-text text-transparent">UPIN</span>
            </div>
          </template>
        </Card>

        <Card v-else class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[28px] !shadow-float !p-3">
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
        <div class="absolute -bottom-5 -left-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-float hidden sm:flex gap-3 items-center max-w-[320px]">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-teal grid place-items-center text-white shrink-0"><i class="pi pi-map-marker text-lg" /></div>
          <div><div class="text-xs font-bold">{{ landing.isUlove.value ? 'Карта в помощь ULove' : landing.isBusiness.value ? 'Кабинет в помощь карте' : 'ULove в помощь карте' }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 leading-snug">{{ landing.isUlove.value ? 'Мэтч? Кинь пин «кофе тут» — встретитесь без адреса.' : landing.isBusiness.value ? 'Метка компании + заметные пины — клиенты идут сами.' : 'Познакомились на районе? Мэтч откроет чат.' }}</div></div>
        </div>
      </div>
    </section>

    <section id="how" class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 scroll-mt-20">
      <Card v-for="step in landing.content.value.steps" :key="step.title" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft card-hover group cursor-default">
        <template #content>
          <div :class="['w-11 h-11 rounded-xl text-white grid place-items-center font-bold text-sm card-icon', landing.theme.value.stepIcon]"><i :class="`pi ${step.icon}`" /></div>
          <h3 class="mt-4 font-bold text-[15px]">{{ step.title }} <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">{{ step.text }}</p>
        </template>
      </Card>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6 grid lg:grid-cols-5 gap-3 sm:gap-4">
      <div class="lg:col-span-3 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-rose-500 to-orange-400 rounded-full blur-[60px] opacity-25"></div>
      <div class="relative w-full max-w-[680px] mx-auto">
          <Tag class="!bg-white/10 !border !border-white/15 !rounded-full !px-3 !py-1 !text-xs !font-medium !text-white">{{ landing.content.value.spotlight.tag }}</Tag>
          <h3 class="mt-4 text-2xl font-black tracking-tight">{{ landing.content.value.spotlight.title }}</h3>
          <p class="text-white/60 mt-2 max-w-xl leading-relaxed">{{ landing.content.value.spotlight.text }}</p>
          <div class="mt-5 grid sm:grid-cols-3 gap-2">
            <div v-for="tile in landing.content.value.spotlight.tiles" :key="tile.top" class="bg-white/10 border border-white/15 rounded-2xl px-3.5 py-3"><div class="text-sm font-bold">{{ tile.top }}</div><div class="text-xs text-white/60 mt-1">{{ tile.sub }}</div></div>
          </div>
          <div class="mt-5 flex flex-wrap gap-2 text-xs font-medium"><Tag class="!bg-white !text-ink-900 !px-3.5 !py-2 !rounded-full !border-0">{{ landing.content.value.spotlight.chips[0] }}</Tag><Tag v-for="chip in landing.content.value.spotlight.chips.slice(1)" :key="chip" class="!bg-white/10 !border !border-white/15 !px-3.5 !py-2 !rounded-full !text-white">{{ chip }}</Tag></div>
          <div class="mt-6"><Link :href="landing.content.value.spotlight.ctaHref"><Button :label="landing.content.value.spotlight.ctaLabel" outlined class="!border-white/25 !text-white !px-6 !py-3 !rounded-full !font-semibold hover:!bg-white/10" /></Link></div>
        </div>
      </div>
      <Card class="lg:col-span-2 !bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[24px] !shadow-soft card-hover overflow-hidden">
        <template #content>
          <Tag class="!bg-white/10 !rounded-full !px-3 !py-1 !text-xs !font-medium !text-white !bg-gradient-to-r !from-rose-500 !to-orange-400 !border-0">{{ landing.content.value.privacy.tag }}</Tag>
          <h3 class="mt-4 text-xl font-black tracking-tight">{{ landing.content.value.privacy.title }}</h3>
          <p class="text-sm text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">{{ landing.content.value.privacy.text }}</p>
          <div class="mt-4 flex flex-wrap gap-2 text-xs font-medium"><Tag v-for="chip in landing.content.value.privacy.chips" :key="chip" class="!bg-stone-100 dark:!bg-zinc-800 !text-ink-900 dark:!text-white !px-3 !py-1.5 !rounded-full !border-0">{{ chip }}</Tag></div>
        </template>
      </Card>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(1.5rem+var(--sab))]">
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[24px] !shadow-soft card-hover">
        <template #content>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="min-w-0"><div class="text-[18px] sm:text-[20px] font-black tracking-tight text-balance">{{ landing.content.value.finalTitle }}</div><div class="text-sm text-stone-600 dark:text-zinc-400 mt-1">{{ landing.content.value.finalText }}</div></div>
            <Link :href="landing.primaryCta.value.href" class="w-full sm:w-auto shrink-0"><Button :label="landing.primaryCta.value.label" :class="['w-full sm:w-auto !text-white !px-8 !py-3.5 !rounded-full !font-bold whitespace-nowrap hover:opacity-90 !border-0 shadow-soft', landing.theme.value.ctaBtn]" /></Link>
          </div>
        </template>
      </Card>
    </section>

    <AppFooter class="mt-auto w-full" />
    </div>
  </div>
</template>
