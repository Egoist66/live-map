<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { ref, computed } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { usePage } from '@inertiajs/vue3'
import { useSeo } from '@/composables/useSeo'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
const seo = useSeo({
  title: 'FAQ — Как устроен UPin | Вопросы и ответы',
  description: 'Ответы про UPin: что такое пины, приватность 200 м, анонимность, тарифы Free/Pro/Business, радиус 1–5 км и как пользоваться живой картой района.',
  keywords: ['UPin FAQ','что такое UPin','пины','приватность','тарифы'],
})
const page = usePage()
const isAuth = computed(() => !!(page.props.auth as any)?.user)
const Layout = computed(() => isAuth.value ? AuthenticatedLayout : GuestLayout)
const open = ref<string | null>('what')
const sections = [
  { id:'what', title:'Что такое UPin?', icon:'◉', q:'Зачем нужен UPin?', a:`UPin — это живая карта твоего района. Здесь соседи делятся тем, что происходит прямо сейчас рядом: просят о помощи, отдают вещи, предупреждают, зовут на встречу. Никакой общей ленты на весь город — только то, что в паре минут от тебя.` },
  { id:'pins', title:'Пины', icon:'📍', q:'Что такое пин?', a:`Пин — короткая заметка на карте. Заголовок, пара строк описания и точка. Категории простые: Вопрос, Объявление, Предупреждение, Событие, Отдам, Помощь. Выбрал категорию, поставил точку — и тебя уже видят рядом.` },
  { id:'ttl', title:'Сколько живёт пин', icon:'⏳', q:'Как долго виден мой пин?', a:`Пины временные — как истории. На бесплатном тарифе — около 2 часов, на Pro и Business — до суток. Так лента всегда свежая, без старого мусора. Если нужно дольше — можно продлить.` },
  { id:'radius', title:'Кто меня видит', icon:'◎', q:'Кто увидит мой пин?', a:`Только люди поблизости. Обычно это 1 км вокруг тебя, на платных тарифах — дальше. Если ты в другом районе — пин не попадёт в чужую ленту. Всё честно и по-соседски.` },
  { id:'privacy', title:'Приватность', icon:'🔒', q:'А где моя точная точка?', a:`Твоё точное место никто не видит. По умолчанию точка смещается примерно на 200 метров — этого достаточно, чтобы помочь, но не раскрыть адрес. Хочешь точнее — можешь включить точный режим сам.` },
  { id:'anon', title:'Анонимность', icon:'◐', q:'Можно писать анонимно?', a:`Да. Можно скрыть имя и публиковать пины анонимно. Тогда никто не увидит, кто автор. В настройках можно включить анонимность по умолчанию, а при создании пина — решить отдельно.` },
  { id:'levels', title:'Репутация', icon:'★', q:'Зачем нужна репутация?', a:`Чем больше помогаешь и общаешься — тем выше уровень. Новичок, Местный, Гид — это знак доверия соседей. Люди охотнее откликаются тем, у кого хорошая репутация.` },
  { id:'plans', title:'Тарифы', icon:'💳', q:'Чем отличаются тарифы?', a:`Free — бесплатно, 3 пина в день, базовый радиус. Pro — $4.99 в месяц: без лимитов, видно дальше, пины живут дольше. Business — $19.99: для локального бизнеса, больше охват и отдельная витрина.` },
  { id:'boosts', title:'Продвижение', icon:'🚀', q:'Как поднять свой пин?', a:`Если важно, чтобы пин увидели быстрее — его можно поднять в топ, подсветить или продлить жизнь. Это разовые доплаты, без подписок. Подходит, когда нужно срочно найти помощь или собрать людей.` },
  { id:'comments', title:'Общение', icon:'💬', q:'Как отвечать и общаться?', a:`Под каждым пином — комментарии и реакции. Можно поблагодарить, уточнить детали, договориться. Лишнее легко скрыть, а навязчивых — заблокировать в один клик.` },
  { id:'zones', title:'Уведомления', icon:'🔔', q:'А можно следить за районом?', a:`Да. Подпишись на зону вокруг дома — и будешь получать уведомления о новых пинах рядом. Удобно, чтобы не пропустить важное, даже когда не смотришь карту.` },
  { id:'moderation', title:'Безопасность', icon:'⚠', q:'Что с жалобами и блоками?', a:`Если что-то нарушает правила — пожалуйтесь. Модерация быстро проверяет. Любого человека можно скрыть навсегда — его пины больше не появятся у тебя.` },
  { id:'map', title:'Карта', icon:'🗺', q:'Как пользоваться картой?', a:`Открой карту, выбери фильтр по категории и просто смотри, что рядом. Клик по карте — создать пин. Всё обновляется само каждые полминуты. Можно включить своё местоположение, чтобы быстрее найти соседей.` },
  { id:'account', title:'Аккаунт', icon:'👤', q:'Что с профилем и настройками?', a:`В профиле — твоя аватарка, имя и домашняя зона. В настройках — приватность, тема, смена тарифа и управление пинами. Всё меняется в пару кликов, без лишних форм.` },
]
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
    <component :is="'script'" type="application/ld+json" v-html="JSON.stringify({ '@context':'https://schema.org','@type':'FAQPage', mainEntity: sections.map(s=>({ '@type':'Question', name:s.q, acceptedAnswer:{ '@type':'Answer', text:s.a }})) })"></component>
  </Head>
  <component :is="Layout">
    <div class="min-h-[calc(100vh-64px)] bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <div class="text-center">
          <Card class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-700 !rounded-full !shadow-soft !inline-flex">
            <template #content>
              <div class="flex items-center gap-2 px-1 py-0 text-xs font-semibold"><span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> FAQ · просто о сложном</div>
            </template>
          </Card>
          <h1 class="mt-4 text-[28px] sm:text-[42px] font-black tracking-[-0.04em] leading-[1.05] sm:leading-none dark:text-white text-balance">Как устроен <span class="bg-gradient-to-r from-brand-500 to-accent-teal bg-clip-text text-transparent">UPin</span></h1>
          <p class="mt-3 text-stone-600 dark:text-zinc-400 max-w-[640px] mx-auto">Коротко и по-человечески: что такое пины, как работает приватность, зачем тарифы и как не пропустить важное рядом. Не нашёл ответа — напиши нам пин «Вопрос» на карте.</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/map"><Button label="Открыть карту" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !px-6 !py-2.5 !rounded-full !text-sm !font-semibold !border-0" /></Link>
            <a href="#faq"><Button label="Читать ниже" severity="secondary" outlined class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 !px-6 !py-2.5 !rounded-full !text-sm !font-semibold !text-ink-900 dark:!text-white" /></a>
          </div>
        </div>

        <div id="faq" class="mt-8">
          <Accordion v-model:value="open" class="!flex !flex-col !gap-3">
            <AccordionPanel v-for="s in sections" :key="s.id" :value="s.id" class="!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-[20px] !shadow-soft overflow-hidden card-hover !mb-0">
              <AccordionHeader class="!p-0 !bg-transparent !border-0">
                <div class="w-full flex items-center gap-4 p-5 text-left">
                  <span class="w-10 h-10 rounded-xl bg-ink-900 dark:bg-zinc-800 text-white grid place-items-center text-sm card-icon shrink-0">{{ s.icon }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold tracking-widest uppercase text-stone-400">{{ s.title }}</div>
                    <div class="text-[15px] font-bold leading-tight dark:text-white">{{ s.q }}</div>
                  </div>
                </div>
              </AccordionHeader>
              <AccordionContent class="!p-0 !bg-transparent !border-0">
                <div class="px-5 pb-5">
                  <div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap">{{ s.a }}</div>
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </div>

        <div class="mt-6 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="min-w-0"><div class="font-black">Остались вопросы?</div><div class="text-sm text-white/60">Создай пин «Вопрос» — соседи ответят за минуты.</div></div>
          <Link href="/map" class="w-full sm:w-auto shrink-0"><Button label="Создать вопрос" class="w-full sm:w-auto !bg-white !text-ink-900 !px-6 !py-2.5 !rounded-full !font-bold !border-0" /></Link>
        </div>

        <div class="text-center text-xs text-stone-400 mt-6">UPin · Просто. Рядом. Сейчас · <Link href="/" class="underline">На главную</Link></div>
      </div>
    </div>
  </component>
</template>
