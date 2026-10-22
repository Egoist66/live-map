<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import PageTransition from '@/Components/Features/Feedback/PageTransition.vue'
import AppFooter from '@/Layouts/AppFooter.vue'
import BrandMark from '@/Components/Brand/BrandMark.vue'
import AuthBackdrop from '@/Components/Features/Auth/AuthBackdrop.vue'
import { useAuthBackdrop } from '@/composables/useAuthBackdrop'
import PwaInstallBanner from '@/Components/Features/Pwa/PwaInstallBanner.vue'
import PwaUpdateBanner from '@/Components/Features/Pwa/PwaUpdateBanner.vue'
import NetworkStatusToast from '@/Components/Features/Feedback/NetworkStatusToast.vue'
import { computed } from 'vue'
import { useGuestLayout } from '@/composables/useGuestLayout'
import { useClientReady } from '@/composables/useClientReady'
import { useGlobalDialogDismiss } from '@/composables/useGlobalDialogDismiss'

useGlobalDialogDismiss()

const { isFaq, isAuthPage, shouldShowFooter } = useGuestLayout()
const { isClientReady } = useClientReady()
const backdrop = useAuthBackdrop()

/**
 * Вход и регистрация — всегда в стиле ULove: центрированная
 * стеклянная карточка на фоне с сердцами, без левого сайдбара.
 */
const hideSidebar = computed(() => isAuthPage.value)
</script>

<template>
  <div class="min-h-screen min-h-dvh flex w-full overflow-x-clip bg-surface dark:bg-[#0F121F]">
    <div v-if="!hideSidebar" class="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 bg-ink-900 text-white relative overflow-hidden">
      <div class="absolute inset-0">
        <div class="absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 24px 24px"></div>
        <div class="absolute -top-24 -right-24 w-[520px] h-[520px] bg-gradient-to-br from-brand-500 via-violet-600 to-accent-teal rounded-full blur-[90px] opacity-25"></div>
        <div class="absolute -bottom-32 -left-32 w-[480px] h-[480px] bg-gradient-to-tr from-amber-500 to-accent-coral rounded-full blur-[80px] opacity-15"></div>
      </div>
      <div class="relative p-8 xl:p-9 flex flex-col w-full">
        <Link href="/" class="flex items-center gap-2.5 shrink-0">
          <span class="w-9 h-9 rounded-xl overflow-hidden shadow-soft shrink-0 grid place-items-center"><BrandMark class="h-full w-full" /></span>
          <span class="font-black tracking-[-0.03em] text-xl">U<span class="font-light opacity-80">Love</span></span>
        </Link>
        <div class="mt-8">
          <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/15 rounded-full px-3 py-1.5 text-xs font-medium">
            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> live • новые анкеты
          </div>
          <h2 class="mt-5 text-[36px] xl:text-[40px] font-black leading-[0.9] tracking-[-0.04em]">Знакомства<br /><span class="bg-gradient-to-r from-[#FFFFFF] via-rose-200 to-orange-200 bg-clip-text text-transparent">рядом с тобой</span></h2>
          <p class="text-white/60 mt-3 leading-relaxed text-[14px]">Свайпай людей рядом, лайкай в один тап и переписывайся только по взаимности.</p>
          <div class="mt-6 grid grid-cols-1 gap-3">
            <div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-white text-ink-900 grid place-items-center text-sm shrink-0">💘</div>
              <div class="min-w-0"><div class="text-sm font-semibold truncate">Мэтч открывает чат</div><div class="text-xs text-white/50 truncate">Без мэтча — никаких сообщений</div></div>
            </div>
            <div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-sm shrink-0">🛡️</div>
              <div class="min-w-0"><div class="text-sm font-semibold truncate">Приватность под контролем</div><div class="text-xs text-white/50 truncate">Анонимно по желанию · блок в 1 клик</div></div>
            </div>
          </div>
        </div>
        <div class="mt-auto pt-8 flex items-center justify-between text-xs text-white/40">
          <span>© ULove · 18+</span><span>PWA · ставится как приложение</span>
        </div>
      </div>
    </div>
    <div :class="isFaq ? 'flex-1 flex flex-col px-0 py-0 relative dark:bg-[#0F121F] overflow-auto min-w-0 w-full overflow-x-clip pt-tg-chrome pb-[var(--sab,0px)]' : 'flex-1 flex flex-col items-center px-4 sm:px-6 relative dark:bg-[#0F121F] min-w-0 w-full overflow-x-clip pt-tg-chrome pb-[var(--sab,0px)]'">
      <div v-if="!isAuthPage" class="absolute inset-0 bg-gradient-to-b from-white to-surface dark:from-zinc-900 dark:to-[#0F121F]"></div>
      <!-- Фон только после гидратации: без отрицательного z-index, порядок
           в DOM + relative у контента решают наложение. Фон всегда один
           (ULove), поэтому смена login ↔ register его не трогает. -->
      <AuthBackdrop v-else-if="isClientReady" />
      <div :class="isFaq ? 'flex w-full flex-1 flex-col min-w-0' : 'relative flex w-full flex-1 justify-center min-w-0 overflow-x-clip pt-6 sm:pt-10 pb-16 sm:pb-24 guest-auth-scroll'">
      <PageTransition :preset="isAuthPage ? 'auth' : 'fade-slide'" class="w-full min-w-0">
        <template v-if="isFaq">
          <slot />
        </template>
        <template v-else>
          <div class="auth-card-enter w-full max-w-[640px] min-w-0 mx-auto">
            <Link href="/" class="flex items-center justify-center mb-5 sm:mb-6">
              <span class="font-black tracking-[-0.04em] text-[34px] leading-none bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent">ULove</span>
            </Link>
            <Card :class="['w-full max-w-full !bg-white/85 dark:!bg-zinc-900/80 backdrop-blur-xl !border !rounded-[20px] sm:!rounded-[24px] !shadow-float !p-0', backdrop.tokens.value.cardClass]">
              <template #content>
                <div class="p-5 sm:p-8">
                  <slot />
                </div>
              </template>
            </Card>
            <div class="text-xs text-stone-500 dark:text-zinc-400 mt-4 text-center max-w-full px-2 text-balance">Мэтч открывает чат · Анонимно по желанию · Блок в 1 клик</div>
          </div>
          </template>
        </PageTransition>
        </div>
        <div v-if="shouldShowFooter" class="mt-auto hidden w-full lg:block">
          <AppFooter />
        </div>
      </div>
      <!-- Баннеры с Transition + PrimeVue Dialog (Teleport) монтируем только
           после гидратации: их visible флипается в onMounted из стореджа,
           чего сервер не видел — enter-transition во время гидратации даёт
           `insertBefore of null`. См. useClientReady. -->
      <template v-if="isClientReady">
        <NetworkStatusToast />
        <PwaInstallBanner />
        <PwaUpdateBanner />
      </template>
    </div>
</template>

<style scoped>
/* Появление карточки отдано PageTransition (пресет auth: уходящая
   прячется мгновенно, новая плавно проявляется fade + подъём):
   отдельной анимации здесь нет, иначе двойное движение давало
   рваность. Класс auth-card-enter
   оставлен якорем для мобильных правил в app.css (16px в полях).
   Вертикальное центрирование — через margin auto: форма ровно
   по центру, а на маленьких экранах с высокой формой верх
   не обрезается (flex + m-auto вместо items-center).
   Скролл — общий, оконный: внутреннего overflow-y-auto нет, иначе
   на Windows виден классический скроллбар-гutter справа и режется
   нижняя тень-свечение карточки (ей оставлен pb-16/24). */
.guest-auth-scroll .page-transition-wrapper {
  margin-top: auto;
  margin-bottom: auto;
}
</style>
