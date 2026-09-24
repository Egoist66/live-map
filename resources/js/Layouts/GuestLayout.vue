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
import { computed } from 'vue'
import { useGuestLayout } from '@/composables/useGuestLayout'
import { useAuthTheme } from '@/composables/useAuthTheme'
import { useClientReady } from '@/composables/useClientReady'
import { useGlobalDialogDismiss } from '@/composables/useGlobalDialogDismiss'

useGlobalDialogDismiss()

const { isFaq, isAuthPage, shouldShowFooter } = useGuestLayout()
const { isClientReady } = useClientReady()
const authTheme = useAuthTheme()
const backdrop = useAuthBackdrop()

/**
 * Вход и регистрация без левого сайдбара во всех темах:
 * только центрированная стеклянная карточка на тематическом
 * анимированном фоне (`AuthBackdrop`: пины, skyline, сердца).
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
          <span class="font-black tracking-[-0.03em] text-xl">U<span class="font-light opacity-80">Pin</span></span>
        </Link>
        <div class="mt-8">
          <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/15 rounded-full px-3 py-1.5 text-xs font-medium">
            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> live • обновление 30 сек
          </div>
          <h2 class="mt-5 text-[36px] xl:text-[40px] font-black leading-[0.9] tracking-[-0.04em]">Твое окно<br /><span class="bg-gradient-to-r from-[#FFFFFF] via-violet-200 to-teal-200 bg-clip-text text-transparent">во двор</span></h2>
          <p class="text-white/60 mt-3 leading-relaxed text-[14px]">Спокойная карта без шума. Только то, что рядом — прямо сейчас.</p>
          <div class="mt-6 grid grid-cols-1 gap-3">
            <div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-white text-ink-900 grid place-items-center text-sm shrink-0">🗺️</div>
              <div class="min-w-0"><div class="text-sm font-semibold truncate">847 пинов рядом</div><div class="text-xs text-white/50 truncate">Вопросы · События · Помощь</div></div>
            </div>
            <div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-sm shrink-0">◐</div>
              <div class="min-w-0"><div class="text-sm font-semibold truncate">Размытие 200 м</div><div class="text-xs text-white/50 truncate">Ты — пин, не точка</div></div>
            </div>
          </div>
        </div>
        <div class="mt-auto pt-8 flex items-center justify-between text-xs text-white/40">
          <span>© UPin · Пилотный район</span><span>PWA · ставится как приложение</span>
        </div>
      </div>
    </div>
    <div :class="isFaq ? 'flex-1 flex flex-col px-0 py-0 relative dark:bg-[#0F121F] overflow-auto min-w-0 w-full overflow-x-clip' : 'flex-1 flex flex-col items-center px-4 sm:px-6 py-6 sm:py-10 relative dark:bg-[#0F121F] min-w-0 w-full overflow-x-clip'">
      <div v-if="!isAuthPage" class="absolute inset-0 bg-gradient-to-b from-white to-surface dark:from-zinc-900 dark:to-[#0F121F]"></div>
      <!-- Фон только после гидратации: тема читается из стореджа/cookie,
           чего SSR мог не видеть — ранний рендер дал бы mismatch.
           Без отрицательного z-index: в тёмной теме у контента сплошной
           фон, и -z-10 прятал backdrop под него (фон «невидим»).
           Порядок в DOM + relative у контента решают наложение. -->
      <AuthBackdrop v-else-if="isClientReady" />
      <div :class="isFaq ? 'flex w-full flex-1 flex-col min-w-0' : 'relative flex w-full flex-1 items-center justify-center min-w-0'">
      <PageTransition :preset="isAuthPage ? 'fade-blur' : 'fade-slide'">
        <template v-if="isFaq">
          <slot />
        </template>
        <template v-else>
          <div :class="authTheme.isUlove.value ? 'auth-card-enter w-full max-w-[400px] min-w-0 mx-auto' : 'auth-card-enter guest-auth w-full max-w-[440px] min-w-0 mx-auto'">
            <Link v-if="authTheme.isUlove.value" href="/" class="flex items-center justify-center gap-2 mb-5 sm:mb-6">
              <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white shadow-lg shadow-rose-500/30"><i class="pi pi-heart-fill" /></span>
              <span class="font-black tracking-[-0.04em] text-[26px] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent">ULove</span>
            </Link>
            <Link v-else href="/" class="flex items-center gap-2.5 mb-5 sm:mb-6">
              <span class="w-9 h-9 rounded-xl overflow-hidden shrink-0 grid place-items-center"><BrandMark class="h-full w-full" /></span>
              <span class="font-black tracking-[-0.03em] text-xl text-ink-900 dark:text-white">U<span class="font-light text-ink-600 dark:text-zinc-400">Pin</span></span>
            </Link>
            <Card :class="['w-full max-w-full !bg-white/85 dark:!bg-zinc-900/80 backdrop-blur-xl !border !rounded-[20px] sm:!rounded-[24px] !shadow-float !p-0', backdrop.tokens.value.cardClass]">
              <template #content>
                <div class="p-5 sm:p-8">
                  <slot />
                </div>
              </template>
            </Card>
            <div class="text-xs text-stone-500 dark:text-zinc-400 mt-4 text-center max-w-full px-2 text-balance">{{ authTheme.isUlove.value ? 'Мэтч открывает чат · Анонимно по желанию · Блок в 1 клик' : 'Защищено приватностью по умолчанию · Размытие 200м · Блок в 1 клик' }}</div>
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
        <PwaInstallBanner />
        <PwaUpdateBanner />
      </template>
    </div>
</template>

<style scoped>
/* Парадный вход карточки: чистый CSS (без Vue-Transition), поэтому
   безопасен при SSR-гидратации и реплеится при смене лейаута
   (лендинг ↔ вход), смягчая жёсткий монтаж. */
.auth-card-enter {
  animation: auth-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes auth-card-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-card-enter {
    animation: none;
  }
}
</style>
