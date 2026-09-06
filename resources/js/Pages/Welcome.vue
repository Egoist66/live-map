<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed } from 'vue'
import { useSeo } from '@/composables/useSeo'
import { useNavigation } from '@/composables/useNavigation'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
defineProps<{ canLogin: boolean; canRegister: boolean }>()
const seo = useSeo({
  title: 'UPin — Твоё окно во двор | Живая карта района',
  description: 'UPin — гиперлокальная карта района. Пины соседей в радиусе 5 км: вопросы, события, помощь, объявления. Приватность 200 м, анонимно, без спама. Free 4ч · Pro 12ч · Business ∞.',
  keywords: ['UPin','живая карта','карта района','соседи','пины','объявления рядом','помощь соседей'],
})
const page = usePage()
const isAuthenticated = computed(() => !!(page.props.auth as any)?.user)
const { dashboardHref } = useNavigation()
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
    <meta head-key="og:title" property="og:title" :content="seo.title.value" />
    <meta head-key="og:description" property="og:description" :content="seo.description.value" />
  </Head>
  <div class="min-h-screen bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100 antialiased selection:bg-ink-900 dark:selection:bg-brand-500 selection:text-white overflow-x-hidden">
    <header class="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/70 backdrop-blur border-b border-stone-200/60 dark:border-zinc-800">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
        <Link href="/" class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shadow-soft relative overflow-hidden"><span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-teal opacity-90"></span><span class="relative text-sm font-black">◉</span></span>
          <span class="font-black tracking-[-0.03em] text-[19px]">U<span class="font-light text-ink-600 dark:text-zinc-400">Pin</span></span>
          <span class="hidden sm:inline ml-2 text-xs font-medium tracking-wide text-stone-500 dark:text-zinc-500 border-l border-stone-200 dark:border-zinc-700 pl-3">ТВОЕ ОКНО ВО ДВОР</span>
        </Link>
        <nav class="flex items-center gap-2">
          <Link href="/faq" class="hidden sm:inline-flex text-[13px] font-medium text-stone-600 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition">FAQ</Link>
          <Link href="/map" class="hidden sm:inline-flex text-[13px] font-medium text-stone-600 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition">Карта</Link>
          <template v-if="isAuthenticated">
            <Link :href="dashboardHref"><Button label="Профиль" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-6 !py-2.5 !rounded-full !text-sm !font-semibold hover:!bg-ink-800 dark:hover:!bg-zinc-100 !border-0 shadow-soft" /></Link>
          </template>
          <template v-else>
            <Link v-if="canLogin" :href="route('login')"><Button label="Войти" severity="secondary" text class="!text-sm !font-semibold !px-4 !py-2 !rounded-full" /></Link>
            <Link v-if="canRegister" :href="route('register')"><Button label="Начать бесплатно" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-6 !py-2.5 !rounded-full !text-sm !font-semibold hover:!bg-ink-800 dark:hover:!bg-zinc-100 !border-0 shadow-soft" /></Link>
          </template>
        </nav>
      </div>
    </header>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-14 pb-8 sm:pb-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-6 sm:gap-10 items-center overflow-hidden">
      <div>
        <div class="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-full pl-1.5 pr-3 py-1 shadow-soft">
          <Tag class="!bg-emerald-500 !text-white !rounded-full !px-2.5 !py-1 !text-[11px] !font-bold tracking-wide !border-0"><span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block mr-1.5 align-middle"></span>LIVE</Tag>
          <span class="text-xs font-medium text-stone-600 dark:text-zinc-400">847 пинов рядом · обновление 30 сек</span>
        </div>
        <h1 class="mt-5 sm:mt-6 text-[30px] sm:text-[48px] lg:text-[64px] font-black tracking-[-0.04em] sm:tracking-[-0.05em] leading-[0.95] sm:leading-[0.85] dark:text-white break-words text-balance">Район <span class="bg-gradient-to-r from-brand-500 via-violet-500 to-accent-teal bg-clip-text text-transparent">живой</span>,<br />пока ты рядом.</h1>
        <p class="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-stone-600 dark:text-zinc-400 max-w-[560px]">Строгая гиперлокальная сеть вокруг карты. Вопросы, события, помощь и объявления — всё в радиусе 5 км. Без ленты, без шума. Free 4ч · Pro 12ч · Business ∞.</p>
        <div class="mt-6 sm:mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
          <Link href="/map" class="w-full sm:w-auto"><Button label="Открыть карту →" class="w-full sm:w-auto !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-7 !py-3.5 !rounded-full !font-semibold hover:!bg-ink-800 dark:hover:!bg-zinc-100 !border-0 shadow-soft" /></Link>
          <a href="#how" class="w-full sm:w-auto"><Button label="Как это работает" severity="secondary" outlined class="w-full sm:w-auto !bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 !px-7 !py-3.5 !rounded-full !font-semibold hover:!bg-stone-50 dark:hover:!bg-zinc-800 !text-ink-900 dark:!text-white" /></a>
        </div>
        <div class="mt-6 sm:mt-8 flex items-center gap-4 sm:gap-6 flex-wrap py-4 sm:py-5 border-y border-stone-200/60 dark:border-zinc-800 max-w-[520px]">
          <div><div class="font-black text-[22px] tracking-tight">500+</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">активных рядом</div></div>
          <div class="w-px h-10 bg-stone-200 dark:bg-zinc-800"></div>
          <div><div class="font-black text-[22px] tracking-tight">~2 мин</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">создать пин</div></div>
          <div class="w-px h-10 bg-stone-200 dark:bg-zinc-800"></div>
          <div><div class="font-black text-[22px] tracking-tight">200 м</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">размытие по умолч.</div></div>
        </div>
        <div class="mt-4 flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500">
          <span class="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 grid place-items-center">✓</span> Приватность сначала · Анонимно по желанию · Блок в 1 клик
        </div>
      </div>

      <div class="relative">
        <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[28px] !shadow-float !p-3">
          <template #content>
            <div class="aspect-[4/3.1] rounded-[18px] overflow-hidden relative bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700">
              <div class="absolute inset-0 bg-gradient-to-br from-stone-50 to-stone-200 dark:from-zinc-800 dark:to-zinc-900"></div>
              <div class="absolute inset-0 opacity-[0.07] dark:opacity-[0.15]" style="background-image: radial-gradient(circle at 1px 1px, #0F172A 1px, transparent 0); background-size: 20px 20px"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-white/60 dark:from-zinc-900/60 via-transparent to-transparent"></div>
              <div class="absolute top-4 left-4 right-4 flex justify-between">
                <span class="bg-white dark:bg-zinc-800 rounded-full px-3.5 py-2 text-xs font-semibold shadow-card border border-stone-200 dark:border-zinc-700 flex items-center gap-2"><span class="w-6 h-6 rounded-full bg-ink-900 text-white grid place-items-center text-[10px]">?</span> Где починить велик?</span>
                <Badge value="★ ТОП" class="!bg-amber-400 !text-ink-900 !rounded-full !px-3 !py-1.5 !text-xs !font-black shadow" />
              </div>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div class="w-4 h-4 bg-brand-500 rounded-full border-[3px] border-white dark:border-zinc-900 shadow-lg"></div>
                <div class="absolute inset-0 bg-brand-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <div class="absolute bottom-4 left-4 right-4 flex gap-3">
                <div class="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-3.5 shadow-card border border-stone-200 dark:border-zinc-700">
                  <div class="text-xs font-bold flex items-center gap-1.5"><span class="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 grid place-items-center text-white text-[11px]">◐</span> Настолки в кофейне</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-snug">Нас трое, нужен четвёртый. Ленина 15, до 22:00</div>
                  <div class="mt-2.5 flex gap-1.5 items-center"><Badge value="3 💬" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-2.5 !py-1 !rounded-full !text-[11px] !font-medium !border-0" /><Badge value="5 ❤️" severity="secondary" class="!bg-white dark:!bg-zinc-700 !border !border-stone-200 dark:!border-zinc-600 !px-2.5 !py-1 !rounded-full !text-[11px]" /><span class="text-[11px] text-stone-400 ml-auto">до 21:00</span></div>
                </div>
                <div class="hidden sm:flex w-[88px] bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-2xl p-3 flex-col justify-between shadow-card">
                  <div class="text-[11px] font-bold leading-tight">+ Создать пин</div><div class="w-7 h-7 rounded-full bg-white dark:bg-ink-900 dark:text-white text-ink-900 grid place-items-center text-sm ml-auto">＋</div>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between px-1 pt-3">
              <div class="flex -space-x-2"><img src="https://i.pravatar.cc/100?img=11" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900" /><img src="https://i.pravatar.cc/100?img=32" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900" /><img src="https://i.pravatar.cc/100?img=14" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900" /><Badge value="+42" class="!w-7 !h-7 !rounded-full !bg-stone-100 dark:!bg-zinc-800 !border-2 !border-white dark:!border-zinc-900 !grid !place-items-center !text-[10px] !font-bold !text-ink-900 dark:!text-white" /></div>
              <span class="text-xs font-medium text-stone-500 dark:text-zinc-500">сейчас в районе</span>
            </div>
          </template>
        </Card>
        <div class="mt-3 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-float flex sm:hidden gap-3 items-center">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-teal grid place-items-center text-white shrink-0">◉</div>
          <div class="min-w-0"><div class="text-xs font-bold">Твоя приватность</div><div class="text-xs text-stone-500 dark:text-zinc-400 leading-snug">Ты — не точка на карте, ты — пин с размытием 200 м.</div></div>
        </div>
        <div class="absolute -bottom-5 -left-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-float hidden sm:flex gap-3 items-center max-w-[320px]">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-teal grid place-items-center text-white shrink-0">◉</div>
          <div><div class="text-xs font-bold">Твоя приватность</div><div class="text-xs text-stone-500 dark:text-zinc-400 leading-snug">Ты — не точка на карте, ты — пин с размытием 200 м.</div></div>
        </div>
      </div>
    </section>

    <section id="how" class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 scroll-mt-20">
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft card-hover group cursor-default">
        <template #content>
          <div class="w-11 h-11 rounded-xl bg-ink-900 dark:bg-white dark:text-ink-900 text-white grid place-items-center font-bold text-sm card-icon">01</div>
          <h3 class="mt-4 font-bold text-[15px]">Открой карту <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Пины в радиусе: вопросы, события, предупреждения. Фильтр по типу в 1 клик.</p>
        </template>
      </Card>
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft card-hover group cursor-default">
        <template #content>
          <div class="w-11 h-11 rounded-xl bg-brand-500 text-white grid place-items-center font-bold text-sm card-icon">02</div>
          <h3 class="mt-4 font-bold text-[15px]">Создай пин <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Выбери точность: 200 м, точно или район. Анонимно или с репутацией.</p>
        </template>
      </Card>
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft card-hover group cursor-default">
        <template #content>
          <div class="w-11 h-11 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold text-sm card-icon">03</div>
          <h3 class="mt-4 font-bold text-[15px]">Получай отклик <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Комментарии, реакции, пуши подписчикам. Больше реакций — дольше жизнь.</p>
        </template>
      </Card>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6 grid lg:grid-cols-5 gap-3 sm:gap-4">
      <div class="lg:col-span-3 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 relative overflow-hidden">
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.06]"></div>
        <div class="relative">
          <Tag class="!bg-white/10 !border !border-white/15 !rounded-full !px-3 !py-1 !text-xs !font-medium !text-white">🔒 Приватность по умолчанию</Tag>
          <h3 class="mt-4 text-2xl font-black tracking-tight">Спокойная карта. Без слежки.</h3>
          <p class="text-white/60 mt-2 max-w-xl leading-relaxed">Точное место никогда не показывается. По умолчанию смещение 200 м, сообщения — только взаимно, блок — в один клик.</p>
          <div class="mt-5 flex flex-wrap gap-2 text-xs font-medium"><Tag class="!bg-white !text-ink-900 !px-3.5 !py-2 !rounded-full !border-0">Размытие 200 м</Tag><Tag class="!bg-white/10 !border !border-white/15 !px-3.5 !py-2 !rounded-full !text-white">Анонимность</Tag><Tag class="!bg-white/10 !border !border-white/15 !px-3.5 !py-2 !rounded-full !text-white">Без истории перемещений</Tag></div>
        </div>
      </div>
      <Card class="lg:col-span-2 !bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[24px] !shadow-soft card-hover overflow-hidden select-none relative group/monet">
        <template #content>
          <div class="blur-[7px] group-hover/monet:blur-none group-active/monet:blur-none transition-all duration-300">
            <h3 class="font-black tracking-tight">Монетизация для активных</h3><p class="text-xs text-stone-500 dark:text-zinc-500 mt-1">Честные бусты, без навязчивости</p>
            <div class="mt-5 space-y-2.5 text-sm">
              <div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3"><span class="font-medium">Поднять в топ 1 ч</span><Badge value="$0.99" class="!bg-white dark:!bg-zinc-700 !border dark:!border-zinc-600 !px-2.5 !py-1 !rounded-full !text-xs !text-ink-900 dark:!text-white" /></div>
              <div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3"><span class="font-medium">Подсветка на карте</span><Badge value="$1.99" class="!bg-white dark:!bg-zinc-700 !border dark:!border-zinc-600 !px-2.5 !py-1 !rounded-full !text-xs !text-ink-900 dark:!text-white" /></div>
              <div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3"><span class="font-medium">Уведомить 1 км • 1 ч</span><Badge value="$4.99" class="!bg-white dark:!bg-zinc-700 !border dark:!border-zinc-600 !px-2.5 !py-1 !rounded-full !text-xs !text-ink-900 dark:!text-white" /></div>
            </div>
            <div class="mt-4 text-xs text-stone-500 dark:text-zinc-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2.5">Pro $4.99/мес — безлимит, 5 км, 24 ч. Business $19.99 — витрина.</div>
          </div>
          <div class="absolute inset-0 grid place-items-center bg-white/55 dark:bg-zinc-900/55 backdrop-blur-[1px] group-hover/monet:opacity-0 group-hover/monet:pointer-events-none group-active/monet:opacity-0 group-active/monet:pointer-events-none transition duration-300">
            <span class="inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg tracking-wide">
              <span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span> В разработке — наведите чтобы посмотреть
            </span>
          </div>
        </template>
      </Card>
    </section>

    <section class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[24px] !shadow-soft card-hover">
        <template #content>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="min-w-0"><div class="text-[18px] sm:text-[20px] font-black tracking-tight text-balance">Готов почувствовать пульс района?</div><div class="text-sm text-stone-600 dark:text-zinc-400 mt-1">Создай первый пин за 2 минуты. Живут 2 часа — не пропусти.</div></div>
            <Link href="/map" class="w-full sm:w-auto shrink-0"><Button label="Открыть карту — бесплатно" class="w-full sm:w-auto !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-8 !py-3.5 !rounded-full !font-semibold whitespace-nowrap hover:!bg-ink-800 dark:hover:!bg-zinc-100 !border-0 shadow-soft" /></Link>
          </div>
        </template>
      </Card>
      <div class="text-center text-xs text-stone-400 mt-6 tracking-wide">© UPin · <Link href="/faq" class="underline hover:text-ink-900 dark:hover:text-white">FAQ</Link> · Пилотный район · PWA в доступе</div>
    </section>
  </div>
</template>
