<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import PageTransition from '@/Components/Features/Feedback/PageTransition.vue'
import AppFooter from '@/Layouts/AppFooter.vue'
import BrandMark from '@/Components/Brand/BrandMark.vue'
import PwaInstallBanner from '@/Components/Features/Pwa/PwaInstallBanner.vue'
import PwaUpdateBanner from '@/Components/Features/Pwa/PwaUpdateBanner.vue'
import { useGuestLayout } from '@/composables/useGuestLayout'
import { useClientReady } from '@/composables/useClientReady'

const { isFaq, isAuthPage, shouldShowFooter } = useGuestLayout()
const { isClientReady } = useClientReady()
</script>

<template>
  <div class="min-h-screen min-h-dvh flex w-full overflow-x-clip bg-surface dark:bg-[#0B0F1A]">
    <div class="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 bg-ink-900 text-white relative overflow-hidden">
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
    <div :class="isFaq ? 'flex-1 flex flex-col px-0 py-0 relative dark:bg-[#0B0F1A] overflow-auto min-w-0 w-full overflow-x-clip' : 'flex-1 flex flex-col items-center px-4 sm:px-6 py-6 sm:py-10 relative dark:bg-[#0B0F1A] min-w-0 w-full overflow-x-clip'">
      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-white to-surface dark:from-zinc-900 dark:to-[#0B0F1A]"></div>
      <div :class="isFaq ? 'flex w-full flex-1 flex-col min-w-0' : 'flex w-full flex-1 items-center justify-center min-w-0'">
      <PageTransition :preset="isAuthPage ? 'none' : 'fade-slide'">
        <template v-if="isFaq">
          <slot />
        </template>
        <template v-else>
          <div class="guest-auth w-full max-w-[440px] min-w-0 mx-auto">
            <Link href="/" class="lg:hidden flex items-center gap-2.5 mb-5 sm:mb-6">
              <span class="w-9 h-9 rounded-xl overflow-hidden shrink-0 grid place-items-center"><BrandMark class="h-full w-full" /></span>
              <span class="font-black tracking-[-0.03em] text-xl text-ink-900 dark:text-white">U<span class="font-light text-ink-600 dark:text-zinc-400">Pin</span></span>
            </Link>
            <Card class="w-full max-w-full !bg-white dark:!bg-zinc-900 !border !border-stone-200/70 dark:!border-zinc-800 !rounded-[20px] sm:!rounded-[24px] !shadow-float !p-0">
              <template #content>
                <div class="p-5 sm:p-8">
                  <slot />
                </div>
              </template>
            </Card>
            <div class="text-xs text-stone-500 dark:text-zinc-400 mt-4 text-center max-w-full px-2 text-balance">Защищено приватностью по умолчанию · Размытие 200м · Блок в 1 клик</div>
          </div>
          </template>
        </PageTransition>
        </div>
        <div v-if="shouldShowFooter" class="mt-auto w-full">
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
